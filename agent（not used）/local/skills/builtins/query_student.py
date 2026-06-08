"""
查询学生 Skill

查询学生信息、进度、成绩等。
"""

import logging
from typing import Dict, List, Any

from local.skills.base import SkillBase, SkillResult, SkillStep

logger = logging.getLogger("query_student_skill")


class QueryStudentSkill(SkillBase):
    """
    查询学生 Skill

    工作流：
    1. 查询学生信息
    2. 查询学习进度
    3. 查询成绩/提交记录
    """

    def __init__(self):
        workflow = [
            SkillStep(
                step=1,
                action="get_student_info",
                name="学生信息",
                description="获取学生基本信息",
                optional=False,
                tools_required=["get_student"]
            ),
            SkillStep(
                step=2,
                action="get_student_progress",
                name="学习进度",
                description="获取学生学习进度",
                optional=True,
                tools_required=["get_student_progress"]
            ),
            SkillStep(
                step=3,
                action="get_student_records",
                name="提交记录",
                description="获取学生提交记录和成绩",
                optional=True,
                tools_required=["get_student_records"]
            )
        ]

        params_template = {
            "student_id": {
                "default": None,
                "required": False,
                "description": "学生 ID"
            },
            "student_name": {
                "default": None,
                "required": False,
                "description": "学生姓名（用于模糊搜索）"
            },
            "query_type": {
                "default": "all",
                "options": ["basic", "progress", "records", "all"],
                "required": False,
                "description": "查询类型"
            }
        }

        super().__init__(
            skill_id="builtin_query_student",
            name="查询学生",
            description="查询学生信息、学习进度、提交记录",
            trigger_keywords=[
                "查询学生", "学生信息", "学生进度", "查看学生",
                "学生成绩", "查找学生"
            ],
            workflow=workflow,
            params_template=params_template
        )

    async def execute(
        self,
        params: Dict,
        context: Dict = None,
        on_step_complete=None
    ) -> SkillResult:
        """执行查询学生流程"""
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

        if action == "get_student_info":
            return await self._get_student_info(params, current_data)

        if action == "get_student_progress":
            query_type = params.get("query_type", "all")
            if query_type in ["progress", "all"]:
                return await self._get_student_progress(params, current_data)
            return {"success": True, "data": {"skipped": True}}

        if action == "get_student_records":
            query_type = params.get("query_type", "all")
            if query_type in ["records", "all"]:
                return await self._get_student_records(params, current_data)
            return {"success": True, "data": {"skipped": True}}

        return {"success": True, "data": {}}

    async def _get_student_info(self, params: Dict, current_data: Dict) -> Dict:
        """获取学生信息"""
        student_id = params.get("student_id")
        student_name = params.get("student_name")

        if not student_id and not student_name:
            return {
                "success": False,
                "error": "需要提供学生 ID 或姓名"
            }

        if self._mcp_client:
            if student_id:
                result = await self._mcp_client.call_tool(
                    "get_student",
                    {"student_id": student_id}
                )
            else:
                # 搜索学生
                result = await self._mcp_client.call_tool(
                    "search_students",
                    {"name": student_name}
                )

            if result.success:
                students = result.result.get("students", []) or [result.result]

                if students:
                    return {
                        "success": True,
                        "data": {
                            "student_info": students[0],
                            "student_id": students[0].get("id")
                        }
                    }
                else:
                    return {
                        "success": False,
                        "error": "未找到学生"
                    }

        return {
            "success": True,
            "data": {
                "student_info": {"name": student_name or "未知"}
            }
        }

    async def _get_student_progress(self, params: Dict, current_data: Dict) -> Dict:
        """获取学习进度"""
        student_id = current_data.get("student_id") or params.get("student_id")

        if self._mcp_client:
            result = await self._mcp_client.call_tool(
                "get_student_progress",
                {"student_id": student_id}
            )

            if result.success:
                return {
                    "success": True,
                    "data": {
                        "progress": result.result.get("progress", {})
                    }
                }

        return {"success": True, "data": {"progress": {}}}

    async def _get_student_records(self, params: Dict, current_data: Dict) -> Dict:
        """获取提交记录"""
        student_id = current_data.get("student_id") or params.get("student_id")

        if self._mcp_client:
            result = await self._mcp_client.call_tool(
                "get_student_records",
                {
                    "student_id": student_id,
                    "limit": 10
                }
            )

            if result.success:
                return {
                    "success": True,
                    "data": {
                        "records": result.result.get("records", [])
                    }
                }

        return {"success": True, "data": {"records": []}}