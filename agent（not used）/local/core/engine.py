"""
QueryEngine - Agent 主循环状态机

参考 Claude Code 的 QueryEngine.ts 设计，实现独立版本。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

from local.core.state import AgentState, StateManager
from local.core.session import SessionManager

logger = logging.getLogger("query_engine")


@dataclass
class ToolResponse:
    """工具响应"""
    type: str  # "text", "tool_use", "tool_result", "error"
    content: str = ""
    name: str = ""
    input: Dict = field(default_factory=dict)
    result: Dict = field(default_factory=dict)
    success: bool = True
    error: str = ""


class QueryEngine:
    """
    Agent 主引擎

    负责：
    - 输入处理与状态流转
    - LLM 调用协调
    - MCP 工具调用
    - Session 管理
    - 错误处理与恢复
    """

    def __init__(
        self,
        llm_client,
        mcp_client,
        permission_gate=None,
        memory_store=None
    ):
        self.llm = llm_client
        self.mcp = mcp_client
        self.permission_gate = permission_gate
        self.memory_store = memory_store

        # 状态管理
        self.state_manager = StateManager()
        self.session_manager = SessionManager()

        # 快捷访问
        self.state = AgentState.IDLE

        # 当前处理数据
        self.current_session: Optional[Dict] = None
        self.session_history: List[Dict] = []

        # 回调钩子
        self._on_state_change: Optional[Callable] = None
        self._on_step_complete: Optional[Callable] = None
        self._on_error: Optional[Callable] = None

    def set_callbacks(
        self,
        on_state_change: Callable = None,
        on_step_complete: Callable = None,
        on_error: Callable = None
    ):
        """设置回调钩子"""
        self._on_state_change = on_state_change
        self._on_step_complete = on_step_complete
        self._on_error = on_error

    def _update_state(self, new_state: AgentState, data: Dict = None):
        """更新状态"""
        self.state = new_state
        self.state_manager.set_state(new_state, data)

        if self._on_state_change:
            self._on_state_change(new_state.value, data)

    async def process(self, user_input: str, context: Dict = None) -> Dict[str, Any]:
        """
        处理用户输入

        Args:
            user_input: 用户输入文本
            context: 额外上下文

        Returns:
            处理结果
        """
        # 输入验证
        if not user_input or user_input.strip() == "":
            return {"status": "error", "message": "输入不能为空"}

        self._update_state(AgentState.PROCESSING, {"input": user_input})

        # 确保 Session 存在
        if not self.session_manager.get_current_session():
            await self.start_session()

        # 记录用户消息
        self.session_manager.add_message("user", user_input)

        # 准备消息列表
        messages = self._build_messages(user_input, context)

        responses: List[ToolResponse] = []
        steps: List[Dict] = []

        try:
            # 流式处理 LLM 响应
            async for response in self.llm.stream(messages):
                responses.append(response)

                if response.type == "tool_use":
                    # 权限检查
                    if self.permission_gate:
                        decision = await self.permission_gate.check(
                            response.name,
                            response.input,
                            context.get("user_id") if context else None
                        )

                        if decision.get("need_approval"):
                            self._update_state(AgentState.WAITING_APPROVAL, {
                                "action": response.name,
                                "params": response.input
                            })

                            return {
                                "status": "waiting_approval",
                                "message": decision.get("approval_reason", "需要审批"),
                                "action": response.name,
                                "params": response.input,
                                "steps": steps
                            }

                        if decision.get("need_confirm"):
                            self._update_state(AgentState.WAITING_CONFIRM, {
                                "action": response.name,
                                "params": response.input
                            })

                    # 调用 MCP 工具
                    tool_result = await self.mcp.call_tool(
                        response.name,
                        response.input or {}
                    )

                    step = {
                        "action": response.name,
                        "input": response.input,
                        "success": tool_result.success,
                        "result": tool_result.result if tool_result.success else None,
                        "error": tool_result.error if not tool_result.success else None
                    }
                    steps.append(step)

                    # 记录步骤
                    self.session_manager.add_step(step)

                    if self._on_step_complete:
                        self._on_step_complete(step)

                    # 检查工具结果
                    if not tool_result.success:
                        if "审批" in tool_result.error:
                            self._update_state(AgentState.WAITING_APPROVAL)
                            return {
                                "status": "waiting_approval",
                                "message": tool_result.error,
                                "steps": steps
                            }
                        else:
                            # 其他错误，继续处理或返回
                            logger.warning(f"Tool error: {tool_result.error}")

            # 完成
            self._update_state(AgentState.COMPLETED)

            # 记录响应消息
            response_text = "".join([r.content for r in responses if r.content])
            self.session_manager.add_message("assistant", response_text)

            return {
                "status": "completed",
                "steps": steps,
                "responses": [r.content for r in responses if r.content],
                "session_id": self.session_manager.get_current_session()["id"]
            }

        except Exception as e:
            logger.error(f"Processing error: {e}")
            self._update_state(AgentState.ERROR, {"error": str(e)})

            if self._on_error:
                self._on_error(str(e))

            return {"status": "error", "message": str(e), "steps": steps}

    def _build_messages(self, user_input: str, context: Dict = None) -> List[Dict]:
        """构建消息列表"""
        # 从 Session 获取历史消息
        session_messages = self.session_manager.get_session_messages()

        # 构建新消息
        messages = []

        # 系统提示（如果有记忆）
        if self.memory_store:
            system_prompt = self._build_system_prompt(context)
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})

        # 历史消息（限制数量）
        max_history = 10
        history_messages = session_messages[-max_history:] if len(session_messages) > max_history else session_messages

        for msg in history_messages:
            messages.append({"role": msg["role"], "content": msg["content"]})

        # 当前输入
        messages.append({"role": "user", "content": user_input})

        return messages

    def _build_system_prompt(self, context: Dict = None) -> str:
        """构建系统提示"""
        if not self.memory_store:
            return ""

        # 从记忆获取偏好
        preferences = self.memory_store.get_preferences()

        prompt_parts = [
            "你是 GESP 教育平台的智能助手。",
            f"教师偏好风格: {preferences.get('style', '专业助手')}"
        ]

        return "\n".join(prompt_parts)

    async def start_session(self, workflow_type: str = None) -> str:
        """开始新 Session"""
        session_id = self.session_manager.start_session(workflow_type)
        self.current_session = self.session_manager.get_current_session()
        self.session_history = self.session_manager.list_sessions()

        self._update_state(AgentState.IDLE)

        return session_id

    async def end_session(self):
        """结束当前 Session"""
        await self.session_manager.end_session()
        self.current_session = None
        self._update_state(AgentState.IDLE)

    async def load_session(self, session_id: str) -> Optional[Dict]:
        """加载历史 Session"""
        return self.session_manager.load_session(session_id)

    async def continue_session(self, session_id: str) -> bool:
        """继续历史 Session"""
        success = self.session_manager.continue_session(session_id)
        if success:
            self.current_session = self.session_manager.get_current_session()
            self._update_state(AgentState.IDLE)
        return success

    async def handle_approval_response(
        self,
        approval_id: int,
        approved: bool,
        reason: str = None
    ) -> Dict:
        """处理审批响应"""
        if approved:
            # 执行之前等待的操作
            state_data = self.state_manager.get_state_data()
            action = state_data.get("action")
            params = state_data.get("params")

            if action and params:
                tool_result = await self.mcp.call_tool(action, params)

                self._update_state(AgentState.COMPLETED)

                return {
                    "status": "completed",
                    "action": action,
                    "success": tool_result.success,
                    "result": tool_result.result
                }
        else:
            self._update_state(AgentState.IDLE)
            return {
                "status": "rejected",
                "approval_id": approval_id,
                "reason": reason
            }

    async def handle_user_confirm(self, confirmed: bool) -> Dict:
        """处理用户确认"""
        state_data = self.state_manager.get_state_data()
        action = state_data.get("action")
        params = state_data.get("params")

        if confirmed and action and params:
            # 继续执行
            self._update_state(AgentState.PROCESSING)

            tool_result = await self.mcp.call_tool(action, params)

            self._update_state(AgentState.COMPLETED)

            return {
                "status": "completed",
                "action": action,
                "success": tool_result.success
            }
        else:
            self._update_state(AgentState.IDLE)
            return {"status": "cancelled"}

    async def reset(self):
        """重置引擎状态"""
        self.state_manager.set_state(AgentState.IDLE)
        self.state_manager.clear_state_data()
        self.state_manager.reset_error_count()
        self.state = AgentState.IDLE

    async def shutdown(self):
        """关闭引擎"""
        # 结束当前 Session
        if self.session_manager.get_current_session():
            self.session_manager.end_session(success=False, summary={"reason": "shutdown"})

        self._update_state(AgentState.SHUTDOWN)

        logger.info("QueryEngine shutdown complete")