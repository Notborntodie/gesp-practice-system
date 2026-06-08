"""
MCP Tools 注册中心

注册所有 MCP Tools，包装 Backend API。
"""

import logging
from typing import Dict, Callable, Any

logger = logging.getLogger("mcp_tools")

# ============================================================
# 全局 Tool 注册表
# ============================================================
_tool_registry: Dict[str, Callable] = {}


def register_tool(name: str, handler: Callable, description: str = "", params_schema: dict = None):
    """注册 MCP Tool"""
    handler.description = description
    handler.params_schema = params_schema or {}
    _tool_registry[name] = handler
    logger.info(f"注册 Tool: {name}")


def get_tool(name: str) -> Callable:
    """获取 Tool"""
    return _tool_registry.get(name)


def list_tools() -> Dict[str, Callable]:
    """列出所有 Tools"""
    return _tool_registry.copy()


# ============================================================
# 注册所有 Tools
# ============================================================
def register_all_tools(app):
    """注册所有 MCP Tools"""
    from server.mcp.tools.questions_api import register_questions_tools
    from server.mcp.tools.exams_api import register_exams_tools
    from server.mcp.tools.oj_api import register_oj_tools
    from server.mcp.tools.learning_plans_api import register_learning_plans_tools
    from server.mcp.tools.teachers_api import register_teachers_tools
    from server.mcp.tools.knowledge_api import register_knowledge_tools

    # 注册各类 Tools
    register_questions_tools()
    register_exams_tools()
    register_oj_tools()
    register_learning_plans_tools()
    register_teachers_tools()
    register_knowledge_tools()

    # 保存到 app state
    app.state.tool_registry = _tool_registry

    logger.info(f"共注册 {len(_tool_registry)} 个 Tools")