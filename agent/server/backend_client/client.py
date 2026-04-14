"""
Backend Client

调用 Backend Server API。
"""

import logging
import os
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("backend_client")


class BackendClient:
    """Backend API Client"""

    def __init__(self):
        self.base_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        self.timeout = httpx.Timeout(30.0)
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP Client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout
            )
        return self._client

    async def get(self, path: str, params: Dict = None) -> Dict:
        """GET 请求"""
        client = await self._get_client()

        try:
            response = await client.get(path, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"GET {path} 失败: {e}")
            return {"error": str(e)}

    async def post(self, path: str, data: Dict = None) -> Dict:
        """POST 请求"""
        client = await self._get_client()

        try:
            response = await client.post(path, json=data)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"POST {path} 失败: {e}")
            return {"error": str(e)}

    async def put(self, path: str, data: Dict = None) -> Dict:
        """PUT 请求"""
        client = await self._get_client()

        try:
            response = await client.put(path, json=data)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"PUT {path} 失败: {e}")
            return {"error": str(e)}

    async def delete(self, path: str) -> Dict:
        """DELETE 请求"""
        client = await self._get_client()

        try:
            response = await client.delete(path)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"DELETE {path} 失败: {e}")
            return {"error": str(e)}

    async def close(self):
        """关闭 Client"""
        if self._client:
            await self._client.aclose()
            self._client = None


# 全单例
backend_client = BackendClient()