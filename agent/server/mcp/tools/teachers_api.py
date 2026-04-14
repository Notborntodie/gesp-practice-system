"""
教师相关 MCP Tools
"""

import logging
from typing import Dict

from server.mcp.tools import register_tool
from server.backend_client.client import BackendClient

logger = logging.getLogger("teachers_tools")
backend = BackendClient()


async def get_teacher_info(params: Dict, user_info: Dict) -> Dict:
    """获取教师信息"""
    teacher_id = params.get("teacher_id", user_info["user_id"])

    response = await backend.get(f"/api/users/{teacher_id}")

    return response


register_tool("get_teacher_info", get_teacher_info, description="获取教师信息")


def register_teachers_tools():
    pass