"""
创建考试 Skill

快速创建一场考试或测验。
"""

import logging
from typing import Dict, List, Any
from datetime import datetime

from local.skills.base import SkillBase, SkillResult, SkillStep

logger = logging.getLogger("create_exam_skill")


class CreateExamSkill(SkillBase):
    """
    创建考试 Skill

    工作流：
    1. 选择题目
    2. 设置考试参数
    3. 创建考试
    """

    def __init__(self):
        workflow = [
            SkillStep(
                step=1,
                action="select_questions",
                name="选择题目",
                description="根据主题选择或生成题目",
                optional=False,
                tools_required=["list_questions", "search_questions"]
            ),
            SkillStep(
                step=2,
                action="set_parameters",
                name="设置参数",
                description="设置考试时间、难度等参数",
                optional=False
            ),
            SkillStep(
                step=3,
                action="create_exam",
                name="创建考试",
                description="创建考试并发布",
                optional=False,
                tools_required=["create_exam"]
            )
        ]

        params_template = {
            "exam_name": {
                "default": None,
                "required": True,
                "description": "考试名称"
            },
            "duration": {
                "default": 60,
                "required": False,
                "description": "考试时长（分钟）"
            },
            "difficulty": {
                "default": "mixed",
                "options": ["easy", "medium", "hard", "mixed"],
                "required": False
            },
            "question_count": {
                "default": 5,
                "required": False,
                "description": "题目数量"
            },
            "category": {
                "default": "GESP",
                "options": ["GESP", "CSP_J", "CSP_S"],
                "required": False
            },
            "topics": {
                "default": None,
                "required": False,
                "description": "知识点范围"
            }
        }

        super().__init__(
            skill_id="builtin_create_exam",
            name="创建考试",
            description="快速创建一场考试，自动选择题目",
            trigger_keywords=["创建考试", "新建考试", "生成试卷", "出题", "组卷"],
            workflow=workflow,
            params_template=params_template
        )

    async def execute(
        self,
        params: Dict,
        context: Dict = None,
        on_step_complete=None
    ) -> SkillResult:
        """执行创建考试流程"""
        return await self.run_workflow(params, context, on_step_complete)

    async def _execute_step(
        self,
        step: SkillStep,
        params: Dict,
        current_data: Dict,
        context: Dict
    ) -> Dict:
        """执行单个步骤"""
        action = step.action

        if action == "select_questions":
            return await self._select_questions(params, current_data)

        if action == "set_parameters":
            return await self._set_parameters(params, current_data)

        if action == "create_exam":
            return await self._create_exam(params, current_data)

        return {"success": True, "data": {}}

    async def _select_questions(self, params: Dict, current_data: Dict) -> Dict:
        """选择题目"""
        category = params.get("category", "GESP")
        difficulty = params.get("difficulty", "mixed")
        question_count = params.get("question_count", 5)
        topics = params.get("topics", [])

        if self._mcp_client:
            # 搜索题目
            result = await self._mcp_client.call_tool(
                "list_questions",
                {
                    "category": category,
                    "difficulty": difficulty if difficulty != "mixed" else None,
                    "limit": question_count * 2  # 多搜索一些以供选择
                }
            )

            if result.success:
                questions = result.result.get("questions", [])

                # 选择题目
                selected = questions[:question_count]

                return {
                    "success": True,
                    "data": {
                        "selected_questions": selected,
                        "question_ids": [q.get("id") for q in selected]
                    }
                }

        # 默认返回空
        return {
            "success": True,
            "data": {
                "selected_questions": [],
                "question_ids": []
            },
            "needs_intervention": True,
            "intervention_reason": "需要手动选择题目"
        }

    async def _set_parameters(self, params: Dict, current_data: Dict) -> Dict:
        """设置考试参数"""
        exam_params = {
            "name": params.get("exam_name", "新考试"),
            "duration": params.get("duration", 60),
            "difficulty": params.get("difficulty", "mixed"),
            "category": params.get("category", "GESP"),
            "start_time": datetime.now().isoformat(),
            "end_time": None  # 待设置
        }

        return {
            "success": True,
            "data": {
                "exam_params": exam_params
            }
        }

    async def _create_exam(self, params: Dict, current_data: Dict) -> Dict:
        """创建考试"""
        exam_params = current_data.get("exam_params", {})
        question_ids = current_data.get("question_ids", [])

        if self._mcp_client:
            result = await self._mcp_client.call_tool(
                "create_exam",
                {
                    "name": exam_params.get("name"),
                    "duration": exam_params.get("duration"),
                    "question_ids": question_ids,
                    "category": exam_params.get("category"),
                    "difficulty": exam_params.get("difficulty")
                }
            )

            if result.success:
                return {
                    "success": True,
                    "data": {
                        "exam_id": result.result.get("exam_id"),
                        "created": True
                    }
                }

        return {"success": True, "data": {"created": True}}