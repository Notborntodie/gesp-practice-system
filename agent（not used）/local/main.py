"""
GESP Agent - 本地 Agent 主入口

用于教师电脑本地运行的智能助手。
"""

import logging
import asyncio
import argparse
from typing import Dict, Optional
from pathlib import Path

from local.core.engine import QueryEngine
from local.core.state import AgentState
from local.llm.client import LLMClient, LLMConfig, ProviderType
from local.mcp_client.client import MCPClient
from local.permissions.gate import PermissionGate
from local.memory.global_store import GlobalMemoryStore
from local.memory.local_store import LocalMemoryStore
from local.memory.style_adapter import StyleAdapter
from local.skills.registry import SkillRegistry
from local.skills.executor import SkillExecutor
from local.skills.builtins.create_question import CreateQuestionSkill
from local.skills.builtins.create_exam import CreateExamSkill
from local.skills.builtins.query_student import QueryStudentSkill

logger = logging.getLogger("gesp_agent")


class GESPAgent:
    """
    GESP Agent 主类

    整合所有组件，提供统一的 Agent 接口。
    """

    def __init__(self, config: Dict):
        self.config = config

        # 初始化组件
        self._init_logging()
        self._init_clients()
        self._init_core()
        self._init_skills()

        # 状态
        self._initialized = False
        self._running = False

    def _init_logging(self):
        """初始化日志"""
        log_level = self.config.get("log_level", "INFO")
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    def _init_clients(self):
        """初始化客户端"""
        # LLM Client
        llm_config = LLMConfig(
            provider=self.config.get("llm_provider", "zhipu"),
            api_key=self.config.get("llm_api_key", ""),
            model=self.config.get("llm_model", "glm-4-plus")
        )
        self.llm_client = LLMClient(llm_config)

        # MCP Client
        self.mcp_client = MCPClient(
            server_url=self.config.get("mcp_server_url", "http://localhost:8001"),
            api_key=self.config.get("mcp_api_key", ""),
            timeout=self.config.get("mcp_timeout", 30)
        )

    def _init_core(self):
        """初始化核心组件"""
        # Permission Gate
        self.permission_gate = PermissionGate()

        # Memory Store
        self.global_memory = GlobalMemoryStore(
            mcp_client=self.mcp_client,
            teacher_id=self.config.get("teacher_id")
        )
        self.local_memory = LocalMemoryStore()

        # Style Adapter
        self.style_adapter = StyleAdapter(
            style=self.config.get("style", "专业助手")
        )

        # Query Engine
        self.engine = QueryEngine(
            llm_client=self.llm_client,
            mcp_client=self.mcp_client,
            permission_gate=self.permission_gate,
            memory_store=self.global_memory
        )

    def _init_skills(self):
        """初始化 Skills"""
        self.skill_registry = SkillRegistry()
        self.skill_executor = SkillExecutor(
            registry=self.skill_registry,
            mcp_client=self.mcp_client,
            llm_client=self.llm_client
        )

        # 注册内置 Skills
        self._register_builtin_skills()

    def _register_builtin_skills(self):
        """注册内置 Skills"""
        builtins = [
            CreateQuestionSkill(),
            CreateExamSkill(),
            QueryStudentSkill()
        ]

        for skill in builtins:
            self.skill_registry.register(skill)

    async def initialize(self) -> Dict:
        """
        初始化 Agent

        Returns:
            初始化结果
        """
        results = {}

        # 测试 LLM 连接
        llm_result = await self.llm_client.test_connection()
        results["llm"] = llm_result

        # 测试 MCP 连接
        mcp_result = await self.mcp_client.test_connection()
        results["mcp"] = mcp_result

        # 加载全局记忆
        if self.config.get("teacher_id"):
            memory_result = await self.global_memory.initialize()
            results["memory"] = {
                "success": memory_result,
                "style": self.global_memory.get_style()
            }

            # 更新风格适配器
            style = self.global_memory.get_style()
            if style:
                self.style_adapter.set_style(style)

        # 检查整体状态
        all_success = (
            llm_result.get("success") and
            mcp_result.get("success")
        )

        self._initialized = all_success

        return {
            "initialized": all_success,
            "details": results
        }

    async def process(self, user_input: str, context: Dict = None) -> Dict:
        """
        处理用户输入

        Args:
            user_input: 用户输入
            context: 上下文

        Returns:
            处理结果
        """
        if not self._initialized:
            return {"status": "error", "message": "Agent 未初始化"}

        # 检查 Skill 匹配
        matched_skill = self.skill_registry.get_best_match(user_input)

        if matched_skill:
            # 执行 Skill
            skill_result = await self.skill_executor.execute_skill(
                matched_skill,
                matched_skill.get_default_params(),
                context
            )

            return {
                "status": "skill_executed",
                "skill": matched_skill.name,
                "success": skill_result.success,
                "message": skill_result.message,
                "data": skill_result.data,
                "steps_completed": skill_result.steps_completed
            }

        # 使用 QueryEngine 处理
        engine_result = await self.engine.process(user_input, context)

        # 适配风格
        if engine_result.get("status") == "completed":
            responses = engine_result.get("responses", [])
            if responses:
                adapted = self.style_adapter.adapt_response(
                    responses[-1],
                    "success"
                )
                engine_result["adapted_response"] = adapted

        return engine_result

    async def start_session(self, workflow_type: str = None) -> str:
        """开始 Session"""
        return await self.engine.start_session(workflow_type)

    async def end_session(self) -> Optional[str]:
        """结束 Session"""
        return await self.engine.end_session()

    async def handle_approval(self, approval_id: int, approved: bool, reason: str = None) -> Dict:
        """处理审批响应"""
        return await self.engine.handle_approval_response(approval_id, approved, reason)

    async def handle_confirm(self, confirmed: bool) -> Dict:
        """处理用户确认"""
        return await self.engine.handle_user_confirm(confirmed)

    async def get_pending_approvals(self) -> list:
        """获取待审批列表"""
        return self.permission_gate.get_pending_approvals()

    async def get_stats(self) -> Dict:
        """获取 Agent 统计"""
        return {
            "initialized": self._initialized,
            "running": self._running,
            "engine_state": self.engine.state.value,
            "llm_stats": self.llm_client.get_stats(),
            "mcp_stats": self.mcp_client.get_stats(),
            "skill_count": self.skill_registry.get_count(),
            "memory_summary": self.global_memory.get_summary()
        }

    async def shutdown(self):
        """关闭 Agent"""
        await self.engine.shutdown()
        await self.llm_client.close()
        await self.mcp_client.close()

        # 同步记忆
        await self.global_memory.sync_to_cloud()

        logger.info("Agent shutdown complete")


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="GESP Agent")
    parser.add_argument("--config", type=str, default="config.json", help="配置文件路径")
    parser.add_argument("--teacher-id", type=int, help="教师 ID")
    parser.add_argument("--llm-provider", type=str, default="zhipu", help="LLM Provider")
    parser.add_argument("--llm-key", type=str, help="LLM API Key")
    parser.add_argument("--mcp-url", type=str, default="http://localhost:8001", help="MCP Server URL")
    parser.add_argument("--mcp-key", type=str, help="MCP API Key")
    parser.add_argument("--style", type=str, default="专业助手", help="对话风格")
    parser.add_argument("--log-level", type=str, default="INFO", help="日志级别")

    args = parser.parse_args()

    # 加载配置
    config = {}
    config_path = Path(args.config)
    if config_path.exists():
        import json
        config = json.loads(config_path.read_text())

    # 命令行参数覆盖
    if args.teacher_id:
        config["teacher_id"] = args.teacher_id
    if args.llm_provider:
        config["llm_provider"] = args.llm_provider
    if args.llm_key:
        config["llm_api_key"] = args.llm_key
    if args.mcp_url:
        config["mcp_server_url"] = args.mcp_url
    if args.mcp_key:
        config["mcp_api_key"] = args.mcp_key
    if args.style:
        config["style"] = args.style
    if args.log_level:
        config["log_level"] = args.log_level

    # 创建 Agent
    agent = GESPAgent(config)

    # 初始化
    init_result = await agent.initialize()
    print(f"初始化结果: {init_result}")

    if not init_result["initialized"]:
        print("初始化失败，退出")
        return

    # 示例交互
    print("Agent 已启动，输入 'exit' 退出")

    while True:
        try:
            user_input = input("\n请输入: ")
            if user_input.lower() == "exit":
                break

            result = await agent.process(user_input)
            print(f"响应: {result}")

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"错误: {e}")

    # 关闭
    await agent.shutdown()
    print("Agent 已关闭")


if __name__ == "__main__":
    # Python 3.6兼容：使用get_event_loop而非run
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())