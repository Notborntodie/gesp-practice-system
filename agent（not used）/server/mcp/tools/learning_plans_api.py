"""
学习计划相关 MCP Tools
"""

import logging
from typing import Dict

from server.mcp.tools import register_tool
from server.backend_client.client import BackendClient

logger = logging.getLogger("learning_plans_tools")
backend = BackendClient()


async def list_learning_plans(params: Dict, user_info: Dict) -> Dict:
    """查询学习计划"""
    student_id = params.get("student_id")
    teacher_id = params.get("teacher_id", user_info["user_id"])

    response = await backend.get("/api/learning-plans", params={
        "student_id": student_id,
        "teacher_id": teacher_id
    })

    return {"plans": response.get("data", [])}


register_tool("list_learning_plans", list_learning_plans, description="查询学习计划")


async def get_student_progress(params: Dict, user_info: Dict) -> Dict:
    """获取学生进度"""
    student_id = params.get("student_id")

    response = await backend.get(f"/api/students/{student_id}/progress")

    return response


register_tool("get_student_progress", get_student_progress, description="获取学生进度")


async def list_students(params: Dict, user_info: Dict) -> Dict:
    """查询学生列表"""
    teacher_id = params.get("teacher_id", user_info["user_id"])

    response = await backend.get("/api/students", params={
        "teacher_id": teacher_id
    })

    return {"students": response.get("data", [])}


register_tool("list_students", list_students, description="查询学生列表")


def register_learning_plans_tools():
    pass