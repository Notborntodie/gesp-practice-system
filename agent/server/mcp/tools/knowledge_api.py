"""
知识库相关 MCP Tools
"""

import logging
from typing import Dict

from server.mcp.tools import register_tool

logger = logging.getLogger("knowledge_tools")


async def search_knowledge(params: Dict, user_info: Dict) -> Dict:
    """搜索知识库"""
    keyword = params.get("keyword")
    level = params.get("level")

    # TODO: 实现知识库搜索
    return {"results": [], "keyword": keyword}


register_tool("search_knowledge", search_knowledge, description="搜索知识库")


def register_knowledge_tools():
    pass