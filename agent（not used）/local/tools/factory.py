"""
Tool Factory

动态创建工具。
"""

import logging
from typing import Dict, Any, Callable, Optional

from local.tools.base import ToolBase, LocalTool, ToolResult

logger = logging.getLogger("tool_factory")


def build_tool(
    name: str,
    description: str,
    execute_func: Callable,
    parameters: Dict = None
) -> LocalTool:
    """
    构建工具

    Args:
        name: 工具名称
        description: 描述
        execute_func: 执行函数
        parameters: 参数定义

    Returns:
        LocalTool
    """
    return LocalTool(
        name=name,
        description=description,
        execute_func=execute_func,
        parameters=parameters
    )


def build_tool_from_config(config: Dict) -> LocalTool:
    """
    从配置构建工具

    Args:
        config: 工具配置

    Returns:
        LocalTool
    """
    return build_tool(
        name=config.get("name", "unnamed"),
        description=config.get("description", ""),
        execute_func=config.get("execute_func", lambda p, c: {}),
        parameters=config.get("parameters", {})
    )


def build_tools_from_list(configs: List[Dict]) -> List[LocalTool]:
    """
    从配置列表构建多个工具

    Args:
        configs: 配置列表

    Returns:
        工具列表
    """
    return [build_tool_from_config(c) for c in configs]


class ToolBuilder:
    """
    Tool Builder

    流式构建工具。
    """

    def __init__(self):
        self._name: str = ""
        self._description: str = ""
        self._execute_func: Optional[Callable] = None
        self._parameters: Dict = {}

    def with_name(self, name: str) -> "ToolBuilder":
        """设置名称"""
        self._name = name
        return self

    def with_description(self, description: str) -> "ToolBuilder":
        """设置描述"""
        self._description = description
        return self

    def with_execute_func(self, func: Callable) -> "ToolBuilder":
        """设置执行函数"""
        self._execute_func = func
        return self

    def with_parameters(self, params: Dict) -> "ToolBuilder":
        """设置参数"""
        self._parameters = params
        return self

    def add_parameter(
        self,
        name: str,
        type: str,
        required: bool = True,
        description: str = ""
    ) -> "ToolBuilder":
        """添加参数"""
        self._parameters[name] = {
            "type": type,
            "required": required,
            "description": description
        }
        return self

    def build(self) -> LocalTool:
        """构建工具"""
        if not self._name:
            raise ValueError("Tool name is required")

        if not self._execute_func:
            raise ValueError("Execute function is required")

        return build_tool(
            name=self._name,
            description=self._description,
            execute_func=self._execute_func,
            parameters=self._parameters
        )


# 预定义工具工厂函数
def create_text_tools() -> List[LocalTool]:
    """创建文本处理工具集"""
    tools = []

    # 大小写转换
    async def case_convert(params, ctx):
        text = params.get("text", "")
        case = params.get("case", "upper")
        if case == "upper":
            return {"data": {"result": text.upper()}}
        elif case == "lower":
            return {"data": {"result": text.lower()}}
        return {"data": {"result": text}}

    tools.append(build_tool(
        name="text_case",
        description="文本大小写转换",
        execute_func=case_convert,
        parameters={
            "text": {"type": "str", "required": True},
            "case": {"type": "str", "required": False}
        }
    ))

    # 文本截取
    async def text_slice(params, ctx):
        text = params.get("text", "")
        start = params.get("start", 0)
        end = params.get("end", len(text))
        return {"data": {"result": text[start:end]}}

    tools.append(build_tool(
        name="text_slice",
        description="文本截取",
        execute_func=text_slice,
        parameters={
            "text": {"type": "str", "required": True},
            "start": {"type": "int", "required": False},
            "end": {"type": "int", "required": False}
        }
    ))

    return tools


def create_data_tools() -> List[LocalTool]:
    """创建数据处理工具集"""
    tools = []

    # JSON 解析
    async def json_parse(params, ctx):
        import json
        text = params.get("text", "")
        try:
            data = json.loads(text)
            return {"data": {"parsed": data}}
        except json.JSONDecodeError as e:
            return {"success": False, "error": str(e)}

    tools.append(build_tool(
        name="json_parse",
        description="JSON 解析",
        execute_func=json_parse,
        parameters={
            "text": {"type": "str", "required": True}
        }
    ))

    # 数据统计
    async def data_stats(params, ctx):
        data = params.get("data", [])
        if not isinstance(data, list):
            return {"success": False, "error": "Data must be a list"}

        numeric_data = [x for x in data if isinstance(x, (int, float))]

        if numeric_data:
            return {
                "data": {
                    "count": len(data),
                    "numeric_count": len(numeric_data),
                    "sum": sum(numeric_data),
                    "avg": sum(numeric_data) / len(numeric_data)
                }
            }

        return {"data": {"count": len(data)}}

    tools.append(build_tool(
        name="data_stats",
        description="数据统计",
        execute_func=data_stats,
        parameters={
            "data": {"type": "list", "required": True}
        }
    ))

    return tools