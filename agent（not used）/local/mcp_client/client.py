"""
MCP Client - 远程 MCP Server 调用

通过 HTTPS 调用云端 MCP Server 的工具。
"""

import logging
import asyncio
import httpx
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("mcp_client")


@dataclass
class ToolResult:
    """工具调用结果"""
    success: bool
    result: Dict = field(default_factory=dict)
    error: str = ""
    tool_name: str = ""
    execution_time_ms: int = 0


class MCPClient:
    """
    MCP Client

    用于本地 Agent 调用云端 MCP Server 的工具。

    功能：
    - 工具列表获取
    - 工具调用（远程）
    - 认证与签名
    - 错误处理
    """

    def __init__(
        self,
        server_url: str,
        api_key: str,
        timeout: int = 30
    ):
        self.server_url = server_url
        self.api_key = api_key
        self.timeout = timeout

        # HTTP Client
        self._client: Optional[httpx.AsyncClient] = None

        # 工具缓存
        self._tools_cache: List[Dict] = []
        self._cache_updated_at: Optional[datetime] = None

        # 调用统计
        self._call_count: int = 0
        self._error_count: int = 0

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP Client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self):
        """关闭 HTTP Client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def list_tools(self, use_cache: bool = True) -> List[Dict]:
        """
        获取可用工具列表

        Args:
            use_cache: 是否使用缓存

        Returns:
            工具列表
        """
        # 检查缓存
        if use_cache and self._tools_cache:
            cache_age = datetime.now() - self._cache_updated_at
            if cache_age.total_seconds() < 3600:  # 1 小时缓存
                return self._tools_cache

        client = await self._get_client()

        try:
            response = await client.get(
                f"{self.server_url}/mcp/tools",
                headers=self._build_headers()
            )

            if response.status_code == 200:
                data = response.json()
                self._tools_cache = data.get("tools", [])
                self._cache_updated_at = datetime.now()
                return self._tools_cache

            logger.error(f"Failed to list tools: {response.status_code}")
            return []

        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            return []

    async def call_tool(
        self,
        tool_name: str,
        params: Dict,
        user_id: int = None
    ) -> ToolResult:
        """
        调用工具

        Args:
            tool_name: 工具名称
            params: 工具参数
            user_id: 用户 ID

        Returns:
            ToolResult
        """
        start_time = datetime.now()
        self._call_count += 1

        client = await self._get_client()

        # 构建请求
        request_body = {
            "tool": tool_name,
            "params": params,
            "user_key": self.api_key
        }

        if user_id:
            request_body["user_id"] = user_id

        try:
            response = await client.post(
                f"{self.server_url}/mcp/call",
                json=request_body,
                headers=self._build_headers()
            )

            execution_time = (datetime.now() - start_time).total_seconds() * 1000

            if response.status_code == 200:
                data = response.json()

                if data.get("success"):
                    return ToolResult(
                        success=True,
                        result=data.get("result", {}),
                        tool_name=tool_name,
                        execution_time_ms=int(execution_time)
                    )
                else:
                    self._error_count += 1
                    return ToolResult(
                        success=False,
                        error=data.get("error", "未知错误"),
                        tool_name=tool_name,
                        execution_time_ms=int(execution_time)
                    )

            else:
                self._error_count += 1
                error_msg = f"HTTP error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return ToolResult(
                    success=False,
                    error=error_msg,
                    tool_name=tool_name,
                    execution_time_ms=int(execution_time)
                )

        except httpx.TimeoutException:
            self._error_count += 1
            return ToolResult(
                success=False,
                error="请求超时",
                tool_name=tool_name
            )

        except Exception as e:
            self._error_count += 1
            logger.error(f"Error calling tool: {e}")
            return ToolResult(
                success=False,
                error=str(e),
                tool_name=tool_name
            )

    async def call_batch(self, calls: List[Dict]) -> List[ToolResult]:
        """
        批量调用工具

        Args:
            calls: 调用列表 [{"tool": "name", "params": {...}]

        Returns:
            结果列表
        """
        results = []
        for call in calls:
            result = await self.call_tool(
                call.get("tool"),
                call.get("params", {}),
                call.get("user_id")
            )
            results.append(result)

        return results

    def _build_headers(self) -> Dict:
        """构建请求头"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Request-Time": datetime.now().isoformat()
        }

    async def health_check(self) -> Dict:
        """健康检查"""
        client = await self._get_client()

        try:
            response = await client.get(f"{self.server_url}/health")

            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "error", "code": response.status_code}

        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def test_connection(self) -> Dict:
        """测试连接"""
        try:
            health = await self.health_check()

            if health.get("status") == "ok":
                tools = await self.list_tools(use_cache=False)
                return {
                    "success": True,
                    "server_url": self.server_url,
                    "tools_available": len(tools),
                    "message": "连接成功"
                }
            else:
                return {
                    "success": False,
                    "error": health.get("message", "健康检查失败")
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "call_count": self._call_count,
            "error_count": self._error_count,
            "error_rate": self._error_count / max(1, self._call_count),
            "tools_cached": len(self._tools_cache)
        }

    def clear_cache(self):
        """清除缓存"""
        self._tools_cache = []
        self._cache_updated_at = None

    def get_cached_tools(self) -> List[Dict]:
        """获取缓存工具"""
        return self._tools_cache

    def find_tool(self, tool_name: str) -> Optional[Dict]:
        """查找工具"""
        for tool in self._tools_cache:
            if tool.get("name") == tool_name:
                return tool
        return None