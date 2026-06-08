"""
Tool 基类

定义本地工具的基本结构（非 MCP 工具）。
"""

import logging
from typing import Dict, Any, Callable, Optional
from dataclasses import dataclass, field
from abc import ABC, abstractmethod

logger = logging.getLogger("tool_base")


@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    data: Dict = field(default_factory=dict)
    message: str = ""
    error: str = ""


class ToolBase(ABC):
    """
    Tool 基类

    本地工具（不通过网络调用）的基础类。
    """

    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict = None
    ):
        self.name = name
        self.description = description
        self.parameters = parameters or {}

        # 执行函数
        self._execute_func: Optional[Callable] = None

    @abstractmethod
    async def execute(self, params: Dict, context: Dict = None) -> ToolResult:
        """
        执行工具

        Args:
            params: 参数
            context: 上下文

        Returns:
            ToolResult
        """
        pass

    def validate_params(self, params: Dict) -> Dict:
        """
        验证参数

        Returns:
            {"valid": bool, "errors": list}
        """
        errors = []

        for key, config in self.parameters.items():
            if config.get("required") and key not in params:
                errors.append(f"缺少必填参数: {key}")

            if "type" in config and key in params:
                expected_type = config["type"]
                actual_type = type(params[key]).__name__
                if expected_type != actual_type:
                    errors.append(f"参数 {key} 类型错误，期望 {expected_type}，实际 {actual_type}")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def get_info(self) -> Dict:
        """获取工具信息"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters
        }


class LocalTool(ToolBase):
    """
    本地工具实现

    用于不需要网络调用的简单工具。
    """

    def __init__(
        self,
        name: str,
        description: str,
        execute_func: Callable,
        parameters: Dict = None
    ):
        super().__init__(name, description, parameters)
        self._execute_func = execute_func

    async def execute(self, params: Dict, context: Dict = None) -> ToolResult:
        """执行"""
        # 验证参数
        validation = self.validate_params(params)
        if not validation["valid"]:
            return ToolResult(
                success=False,
                error=f"参数验证失败: {', '.join(validation['errors'])}"
            )

        try:
            # 执行函数
            result = await self._execute_func(params, context)

            if isinstance(result, dict):
                return ToolResult(
                    success=result.get("success", True),
                    data=result.get("data", {}),
                    message=result.get("message", ""),
                    error=result.get("error", "")
                )

            return ToolResult(success=True, data={"result": result})

        except Exception as e:
            logger.error(f"Tool {self.name} error: {e}")
            return ToolResult(success=False, error=str(e))


# 常用本地工具
def create_echo_tool() -> LocalTool:
    """创建 Echo 工具"""
    return LocalTool(
        name="echo",
        description="回显输入内容",
        execute_func=lambda params, ctx: {"data": params, "message": "Echoed"},
        parameters={
            "message": {"type": "str", "required": True}
        }
    )


def create_math_tool() -> LocalTool:
    """创建简单数学工具"""
    async def math_execute(params, ctx):
        operation = params.get("operation", "add")
        a = params.get("a", 0)
        b = params.get("b", 0)

        if operation == "add":
            result = a + b
        elif operation == "sub":
            result = a - b
        elif operation == "mul":
            result = a * b
        elif operation == "div":
            result = a / b if b != 0 else "Error: division by zero"
        else:
            result = "Unknown operation"

        return {"data": {"result": result}}

    return LocalTool(
        name="math",
        description="简单数学运算",
        execute_func=math_execute,
        parameters={
            "operation": {"type": "str", "required": True},
            "a": {"type": "int", "required": True},
            "b": {"type": "int", "required": True}
        }
    )


def create_format_tool() -> LocalTool:
    """创建格式化工具"""
    async def format_execute(params, ctx):
        text = params.get("text", "")
        format_type = params.get("format", "plain")

        if format_type == "upper":
            result = text.upper()
        elif format_type == "lower":
            result = text.lower()
        elif format_type == "capitalize":
            result = text.capitalize()
        else:
            result = text

        return {"data": {"formatted": result}}

    return LocalTool(
        name="format",
        description="文本格式化",
        execute_func=format_execute,
        parameters={
            "text": {"type": "str", "required": True},
            "format": {"type": "str", "required": False}
        }
    )