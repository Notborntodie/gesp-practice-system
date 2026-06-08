"""
Skill 基类

定义 Skill 的基本结构和接口。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from datetime import datetime

logger = logging.getLogger("skill_base")


@dataclass
class SkillStep:
    """Skill 步骤"""
    step: int
    action: str
    name: str
    description: str = ""
    optional: bool = False
    tools_required: List[str] = field(default_factory=list)


@dataclass
class SkillResult:
    """Skill 执行结果"""
    success: bool
    data: Dict = field(default_factory=dict)
    message: str = ""
    error: str = ""
    steps_completed: int = 0
    steps_total: int = 0
    execution_time_ms: int = 0
    needs_intervention: bool = False
    intervention_reason: str = ""


class SkillBase(ABC):
    """
    Skill 基类

    所有 Skill 必须继承此类并实现 execute 方法。
    """

    def __init__(
        self,
        skill_id: str,
        name: str,
        description: str,
        trigger_keywords: List[str] = None,
        workflow: List[SkillStep] = None,
        params_template: Dict = None
    ):
        self.skill_id = skill_id
        self.name = name
        self.description = description
        self.trigger_keywords = trigger_keywords or []
        self.workflow = workflow or []
        self.params_template = params_template or {}

        # 执行器注入
        self._executor: Optional[Any] = None
        self._mcp_client: Optional[Any] = None
        self._llm_client: Optional[Any] = None

        # 元数据
        self.version: int = 1
        self.author_id: Optional[int] = None
        self.use_count: int = 0
        self.created_at: datetime = datetime.now()

    def set_executor(self, executor):
        """设置执行器"""
        self._executor = executor

    def set_mcp_client(self, client):
        """设置 MCP Client"""
        self._mcp_client = client

    def set_llm_client(self, client):
        """设置 LLM Client"""
        self._llm_client = client

    @abstractmethod
    async def execute(
        self,
        params: Dict,
        context: Dict = None,
        on_step_complete: Callable = None
    ) -> SkillResult:
        """
        执行 Skill

        Args:
            params: 参数
            context: 上下文
            on_step_complete: 步骤完成回调

        Returns:
            SkillResult
        """
        pass

    def matches_trigger(self, text: str) -> bool:
        """检查是否匹配触发词"""
        text_lower = text.lower()
        for keyword in self.trigger_keywords:
            if keyword.lower() in text_lower:
                return True
        return False

    def get_default_params(self) -> Dict:
        """获取默认参数"""
        defaults = {}
        for key, config in self.params_template.items():
            if "default" in config:
                defaults[key] = config["default"]
        return defaults

    def validate_params(self, params: Dict) -> Dict:
        """
        验证参数

        Returns:
            {"valid": bool, "errors": list, "defaults_applied": dict}
        """
        errors = []
        defaults_applied = {}

        for key, config in self.params_template.items():
            # 检查必填
            if config.get("required") and key not in params:
                errors.append(f"缺少必填参数: {key}")
                continue

            # 应用默认值
            if key not in params and "default" in config:
                defaults_applied[key] = config["default"]
                params[key] = config["default"]

            # 检查选项范围
            if "options" in config and key in params:
                if params[key] not in config["options"]:
                    errors.append(f"参数 {key} 值无效，可选值: {config['options']}")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "defaults_applied": defaults_applied
        }

    def get_workflow_description(self) -> str:
        """获取工作流描述"""
        steps_desc = []
        for step in self.workflow:
            steps_desc.append(f"Step {step.step}: {step.name} ({step.action})")
        return "\n".join(steps_desc)

    def get_info(self) -> Dict:
        """获取 Skill 信息"""
        return {
            "skill_id": self.skill_id,
            "name": self.name,
            "description": self.description,
            "trigger_keywords": self.trigger_keywords,
            "workflow_count": len(self.workflow),
            "params_template": self.params_template,
            "version": self.version,
            "use_count": self.use_count
        }

    def increment_use_count(self):
        """增加使用计数"""
        self.use_count += 1

    async def run_workflow(
        self,
        params: Dict,
        context: Dict = None,
        on_step_complete: Callable = None
    ) -> SkillResult:
        """
        运行工作流

        按步骤执行，支持干预点。
        """
        start_time = datetime.now()
        steps_completed = 0
        data = {}

        for step in self.workflow:
            try:
                step_result = await self._execute_step(
                    step,
                    params,
                    data,
                    context
                )

                if not step_result.get("success"):
                    if not step.optional:
                        # 必须步骤失败
                        return SkillResult(
                            success=False,
                            error=step_result.get("error", f"Step {step.step} failed"),
                            steps_completed=steps_completed,
                            steps_total=len(self.workflow),
                            execution_time_ms=(datetime.now() - start_time).total_seconds() * 1000
                        )
                    else:
                        # 可选步骤失败，继续
                        logger.warning(f"Optional step {step.step} failed")

                data.update(step_result.get("data", {}))
                steps_completed += 1

                if on_step_complete:
                    on_step_complete({
                        "step": step.step,
                        "name": step.name,
                        "success": True
                    })

                # 检查干预点
                if step_result.get("needs_intervention"):
                    return SkillResult(
                        success=False,
                        needs_intervention=True,
                        intervention_reason=step_result.get("intervention_reason"),
                        data=data,
                        steps_completed=steps_completed,
                        steps_total=len(self.workflow)
                    )

            except Exception as e:
                logger.error(f"Step {step.step} error: {e}")
                if not step.optional:
                    return SkillResult(
                        success=False,
                        error=str(e),
                        steps_completed=steps_completed,
                        steps_total=len(self.workflow)
                    )

        return SkillResult(
            success=True,
            data=data,
            message=f"Skill {self.name} 执行完成",
            steps_completed=steps_completed,
            steps_total=len(self.workflow),
            execution_time_ms=(datetime.now() - start_time).total_seconds() * 1000
        )

    async def _execute_step(
        self,
        step: SkillStep,
        params: Dict,
        current_data: Dict,
        context: Dict
    ) -> Dict:
        """
        执行单个步骤

        根据步骤 action 类型执行相应操作。
        """
        action = step.action

        # 使用 MCP 工具
        if action in step.tools_required and self._mcp_client:
            result = await self._mcp_client.call_tool(action, params)

            if result.success:
                return {"success": True, "data": result.result}
            else:
                return {"success": False, "error": result.error}

        # 使用 LLM 生成
        if action.startswith("generate_") and self._llm_client:
            return await self._generate_with_llm(action, params, current_data)

        # 验证
        if action == "verify_code" and self._mcp_client:
            return await self._verify_code(params, current_data)

        # 上传
        if action == "upload_to_oj" and self._mcp_client:
            return await self._upload_to_oj(params, current_data)

        # 默认
        return {"success": True, "data": {}}

    async def _generate_with_llm(self, action: str, params: Dict, current_data: Dict) -> Dict:
        """使用 LLM 生成内容"""
        # TODO: 实现 LLM 生成逻辑
        return {"success": True, "data": {"generated": action}}

    async def _verify_code(self, params: Dict, current_data: Dict) -> Dict:
        """验证代码"""
        # TODO: 实现代码验证逻辑
        return {"success": True, "data": {"verified": True}}

    async def _upload_to_oj(self, params: Dict, current_data: Dict) -> Dict:
        """上传到 OJ"""
        # TODO: 实现上传逻辑
        return {"success": True, "data": {"uploaded": True}}