"""
考试相关 MCP Tools
"""

import logging
from typing import Dict

from server.mcp.tools import register_tool
from server.backend_client.client import BackendClient

logger = logging.getLogger("exams_tools")
backend = BackendClient()


async def list_exams(params: Dict, user_info: Dict) -> Dict:
    """查询考试列表"""
    teacher_id = params.get("teacher_id", user_info["user_id"])
    status = params.get("status")

    response = await backend.get("/api/exams", params={
        "teacher_id": teacher_id,
        "status": status
    })

    # Backend返回的是列表，不是字典
    if isinstance(response, list):
        return {"exams": response, "total": len(response)}
    else:
        return {"exams": response.get("data", []), "total": response.get("total", 0)}


register_tool("list_exams", list_exams, description="查询考试列表")


async def create_exam(params: Dict, user_info: Dict) -> Dict:
    """创建考试"""
    response = await backend.post("/api/exams", data={
        "title": params.get("title"),
        "teacher_id": user_info["user_id"],
        "level": params.get("level", 2),
        "duration": params.get("duration", 60),
        "question_ids": params.get("question_ids", [])
    })

    return {"exam_id": response.get("id"), "message": "考试创建成功"}


register_tool("create_exam", create_exam, description="创建考试")


async def update_exam(params: Dict, user_info: Dict) -> Dict:
    """更新考试（需审批）"""
    return {"approval_required": True}


register_tool("update_exam", update_exam, description="更新考试（需审批）")


async def delete_exam(params: Dict, user_info: Dict) -> Dict:
    """删除考试（需审批）"""
    return {"approval_required": True}


register_tool("delete_exam", delete_exam, description="删除考试（需审批）")


def register_exams_tools():
    """注册考试 Tools（已在上面注册）"""
    pass