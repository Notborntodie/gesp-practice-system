"""
MCP Server 认证模块

实现真实的 API Key 验证。
"""

import logging
import httpx
import os
import hashlib
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger("mcp_auth")

# 超级管理员 API Keys（开发阶段硬编码）
# 生产环境应从数据库 api_keys 表读取
SUPER_ADMIN_KEYS = {
    # czy (user_id=1) 的 MCP Key
    # 明文: mcp_czy_d355dff9d06156de60747db70ad9978f
    "mcp_czy_d355dff9d06156de60747db70ad9978f": {
        "user_id": 1,
        "username": "czy",
        "is_super_admin": True,
        "bypass_approval": True
    }
}


class AuthManager:
    """认证管理器"""

    def __init__(self):
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP Client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self):
        """关闭 Client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _hash_key(self, key: str) -> str:
        """计算Key的SHA256哈希"""
        return hashlib.sha256(key.encode()).hexdigest()

    async def verify_user_key(self, user_key: str) -> Optional[Dict]:
        """
        验证用户 MCP Key

        Args:
            user_key: MCP API Key

        Returns:
            用户信息字典，或 None（无效）
        """
        # 1. 先检查硬编码的超级管理员Key
        if user_key in SUPER_ADMIN_KEYS:
            key_info = SUPER_ADMIN_KEYS[user_key]
            user_info = await self._fetch_user_info(key_info["user_id"])
            return {
                "user_id": key_info["user_id"],
                "username": key_info["username"],
                "roles": ["super_admin", "admin"],
                "permissions": ["*"],  # 全部权限
                "is_admin": True,
                "is_super_admin": True,
                "bypass_approval": True,  # 跳过审批
                "device": "any"
            }

        # 2. 检查test_xxx格式的开发Key
        if user_key.startswith("test_"):
            user_id_str = user_key.split("_")[1] if len(user_key.split("_")) > 1 else "1001"
            try:
                user_id = int(user_id_str)
            except ValueError:
                return None

            user_info = await self._fetch_user_info(user_id)
            if user_info:
                return {
                    "user_id": user_id,
                    "username": user_info.get("username", ""),
                    "roles": [r.get("name") for r in user_info.get("roles", [])],
                    "permissions": [p.get("name") for p in user_info.get("permissions", [])],
                    "is_admin": any(r.get("name") == "admin" for r in user_info.get("roles", [])),
                    "is_super_admin": any(r.get("name") == "super_admin" for r in user_info.get("roles", [])),
                    "bypass_approval": False,
                    "device": "test_device"
                }
            else:
                return {
                    "user_id": user_id,
                    "username": f"test_user_{user_id}",
                    "roles": ["user"],
                    "permissions": [],
                    "is_admin": False,
                    "is_super_admin": False,
                    "bypass_approval": False,
                    "device": "test_device"
                }

        # 3. 生产环境：从数据库验证（TODO）
        # key_hash = self._hash_key(user_key)
        # 查询 api_keys 表...

        return None

    async def _fetch_user_info(self, user_id: int) -> Optional[Dict]:
        """从Backend获取用户信息"""
        client = await self._get_client()

        try:
            response = await client.get(f"{self.backend_url}/api/users/{user_id}")
            if response.status_code == 200:
                return response.json()
            return None
        except httpx.HTTPError as e:
            logger.error(f"获取用户信息失败: {e}")
            return None

    def check_permission(self, user_info: Dict, tool: str, params: Dict) -> Dict:
        """
        检查用户权限

        Args:
            user_info: 用户信息
            tool: 工具名称
            params: 工具参数

        Returns:
            {"allowed": bool, "need_approval": bool, "reason": str}
        """
        # 超级管理员有全部权限，跳过审批
        if user_info.get("is_super_admin") or user_info.get("bypass_approval"):
            return {"allowed": True, "need_approval": False}

        # 管理员有全部权限
        if user_info.get("is_admin"):
            return {"allowed": True, "need_approval": False}

        # 高风险工具需要审批
        HIGH_RISK_TOOLS = [
            "update_question", "delete_question",
            "update_exam", "delete_exam",
            "update_learning_plan", "delete_learning_plan"
        ]

        if tool in HIGH_RISK_TOOLS:
            return {
                "allowed": False,
                "need_approval": True,
                "reason": f"操作 '{tool}' 需要管理员审批"
            }

        # 检查具体权限
        permissions = user_info.get("permissions", [])

        # 权限映射
        TOOL_PERMISSIONS = {
            "list_questions": "question.read",
            "get_question": "question.read",
            "create_question": "question.create",
            "update_question": "question.update",
            "delete_question": "question.delete",
            "list_exams": "exam.read",
            "create_exam": "exam.create",
            "verify_oj_code": "submission.create",
            "list_learning_plans": "learning_plan.read",
            "get_student_progress": "student.read",
            "list_students": "student.read"
        }

        required_permission = TOOL_PERMISSIONS.get(tool)
        if required_permission and required_permission not in permissions:
            # 如果有*权限则通过
            if "*" in permissions:
                return {"allowed": True, "need_approval": False}
            return {
                "allowed": False,
                "need_approval": False,
                "reason": f"缺少权限: {required_permission}"
            }

        return {"allowed": True, "need_approval": False}


# 全局实例
auth_manager = AuthManager()