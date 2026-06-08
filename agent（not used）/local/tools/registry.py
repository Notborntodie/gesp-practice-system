"""
Tool 注册表

管理本地工具的注册和查找。
"""

import logging
from typing import Dict, List, Optional

from local.tools.base import ToolBase

logger = logging.getLogger("tool_registry")


class ToolRegistry:
    """
    Tool 注册表

    功能：
    - 工具注册
    - 工具查找
    - 工具列表
    """

    def __init__(self):
        self._tools: Dict[str, ToolBase] = {}

    def register(self, tool: ToolBase) -> bool:
        """注册工具"""
        if tool.name in self._tools:
            logger.warning(f"Tool {tool.name} already registered")
            return False

        self._tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
        return True

    def unregister(self, name: str) -> bool:
        """取消注册"""
        if name not in self._tools:
            return False

        del self._tools[name]
        logger.info(f"Unregistered tool: {name}")
        return True

    def get(self, name: str) -> Optional[ToolBase]:
        """获取工具"""
        return self._tools.get(name)

    def has(self, name: str) -> bool:
        """检查工具是否存在"""
        return name in self._tools

    def list_all(self) -> List[ToolBase]:
        """列出所有工具"""
        return list(self._tools.values())

    def list_names(self) -> List[str]:
        """列出所有工具名称"""
        return list(self._tools.keys())

    def get_count(self) -> int:
        """获取工具数量"""
        return len(self._tools)

    def get_tools_info(self) -> List[Dict]:
        """获取所有工具信息"""
        return [tool.get_info() for tool in self._tools.values()]

    def clear(self):
        """清除所有工具"""
        self._tools = {}

    def search(self, query: str) -> List[ToolBase]:
        """搜索工具"""
        query_lower = query.lower()
        results = []

        for tool in self._tools.values():
            if query_lower in tool.name.lower() or query_lower in tool.description.lower():
                results.append(tool)

        return results