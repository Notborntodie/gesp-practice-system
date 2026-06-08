"""
Skill 执行器

执行 Skill 工作流，处理干预点。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime

from local.skills.base import SkillBase, SkillResult, SkillStep

logger = logging.getLogger("skill_executor")


class SkillExecutor:
    """
    Skill 执行器

    功能：
    - 执行 Skill 工作流
    - 处理干预点
    - 跟踪执行状态
    - 支持暂停/恢复
    """

    def __init__(self, registry=None, mcp_client=None, llm_client=None):
        self.registry = registry
        self.mcp_client = mcp_client
        self.llm_client = llm_client

        # 执行状态
        self._current_skill: Optional[SkillBase] = None
        self._current_step: int = 0
        self._is_paused: bool = False
        self._pause_data: Dict = {}

        # 回调
        self._on_step_complete: Optional[Callable] = None
        self._on_intervention: Optional[Callable] = None

    def set_callbacks(
        self,
        on_step_complete: Callable = None,
        on_intervention: Callable = None
    ):
        """设置回调"""
        self._on_step_complete = on_step_complete
        self._on_intervention = on_intervention

    async def execute_skill(
        self,
        skill: SkillBase,
        params: Dict,
        context: Dict = None
    ) -> SkillResult:
        """
        执行 Skill

        Args:
            skill: Skill 实例
            params: 参数
            context: 上下文

        Returns:
            SkillResult
        """
        # 设置执行环境
        skill.set_executor(self)
        skill.set_mcp_client(self.mcp_client)
        skill.set_llm_client(self.llm_client)

        # 验证参数
        validation = skill.validate_params(params)
        if not validation["valid"]:
            return SkillResult(
                success=False,
                error=f"参数验证失败: {', '.join(validation['errors'])}"
            )

        # 应用默认值
        params.update(validation["defaults_applied"])

        # 记录当前 Skill
        self._current_skill = skill
        self._current_step = 0
        self._is_paused = False

        # 增加使用计数
        skill.increment_use_count()

        # 执行
        result = await skill.execute(
            params,
            context,
            self._on_step_complete
        )

        # 清除
        self._current_skill = None
        self._current_step = 0

        return result

    async def execute_by_id(
        self,
        skill_id: str,
        params: Dict,
        context: Dict = None
    ) -> SkillResult:
        """
        按 ID 执行 Skill

        Args:
            skill_id: Skill ID
            params: 参数
            context: 上下文

        Returns:
            SkillResult
        """
        if not self.registry:
            return SkillResult(success=False, error="Registry not set")

        skill = self.registry.get(skill_id)
        if not skill:
            return SkillResult(success=False, error=f"Skill not found: {skill_id}")

        return await self.execute_skill(skill, params, context)

    async def execute_by_trigger(
        self,
        text: str,
        params: Dict = None,
        context: Dict = None
    ) -> SkillResult:
        """
        根据触发词执行

        Args:
            text: 输入文本
            params: 参数（可选）
            context: 上下文

        Returns:
            SkillResult
        """
        if not self.registry:
            return SkillResult(success=False, error="Registry not set")

        skill = self.registry.get_best_match(text)
        if not skill:
            return SkillResult(success=False, error="No matching skill found")

        # 使用默认参数
        params = params or skill.get_default_params()

        return await self.execute_skill(skill, params, context)

    async def resume_paused(self, user_input: Dict) -> SkillResult:
        """
        恢复暂停的执行

        Args:
            user_input: 用户输入数据

        Returns:
            SkillResult
        """
        if not self._is_paused or not self._current_skill:
            return SkillResult(success=False, error="No paused execution")

        # 合并用户输入到暂停数据
        self._pause_data["user_input"] = user_input

        self._is_paused = False

        # 继续执行
        # TODO: 实现从暂停点继续的逻辑

        return SkillResult(
            success=True,
            message="Resumed from pause"
        )

    def pause(self, reason: str = ""):
        """暂停执行"""
        self._is_paused = True
        self._pause_data["reason"] = reason
        logger.info(f"Execution paused: {reason}")

    def get_current_state(self) -> Dict:
        """获取当前执行状态"""
        return {
            "skill_id": self._current_skill.skill_id if self._current_skill else None,
            "skill_name": self._current_skill.name if self._current_skill else None,
            "current_step": self._current_step,
            "is_paused": self._is_paused,
            "pause_reason": self._pause_data.get("reason", "")
        }

    async def handle_intervention(self, intervention_data: Dict) -> Dict:
        """
        处理干预

        Args:
            intervention_data: 干预数据

        Returns:
            处理结果
        """
        if self._on_intervention:
            return await self._on_intervention(intervention_data)

        # 默认处理：暂停并等待
        self.pause(intervention_data.get("reason", "需要干预"))

        return {
            "status": "paused",
            "message": "等待用户干预"
        }

    async def run_step(
        self,
        step: SkillStep,
        params: Dict,
        current_data: Dict,
        context: Dict
    ) -> Dict:
        """
        运行单个步骤

        Args:
            step: 步骤定义
            params: 参数
            current_data: 当前数据
            context: 上下文

        Returns:
            步骤结果
        """
        self._current_step = step.step

        logger.info(f"Running step {step.step}: {step.name}")

        # 更新回调
        if self._on_step_complete:
            self._on_step_complete({
                "step": step.step,
                "name": step.name,
                "status": "running"
            })

        # 执行步骤
        try:
            result = await self._current_skill._execute_step(
                step,
                params,
                current_data,
                context
            )

            if self._on_step_complete:
                self._on_step_complete({
                    "step": step.step,
                    "name": step.name,
                    "status": "completed",
                    "success": result.get("success")
                })

            return result

        except Exception as e:
            logger.error(f"Step {step.step} error: {e}")

            if self._on_step_complete:
                self._on_step_complete({
                    "step": step.step,
                    "name": step.name,
                    "status": "error",
                    "error": str(e)
                })

            return {"success": False, "error": str(e)}

    async def batch_execute(
        self,
        skills: List[Dict],
        context: Dict = None
    ) -> List[SkillResult]:
        """
        批量执行 Skills

        Args:
            skills: Skill 列表 [{"skill_id": "...", "params": {...}]
            context: 上下文

        Returns:
            结果列表
        """
        results = []

        for skill_config in skills:
            result = await self.execute_by_id(
                skill_config.get("skill_id"),
                skill_config.get("params", {}),
                context
            )
            results.append(result)

        return results

    def get_stats(self) -> Dict:
        """获取执行统计"""
        return {
            "current_skill": self._current_skill.skill_id if self._current_skill else None,
            "current_step": self._current_step,
            "is_paused": self._is_paused
        }