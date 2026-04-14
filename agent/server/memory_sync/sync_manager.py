"""
记忆同步管理器

同步全局记忆到云端。
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("memory_sync")


class MemorySyncManager:
    """
    记忆同步管理器

    功能：
    - 同步用户偏好
    - 同步习惯数据
    - 同步订阅列表
    - 处理多设备同步
    """

    def __init__(self, db_config: Dict = None, mcp_client=None):
        self.db_config = db_config
        self.mcp_client = mcp_client

        # 内存缓存
        self._memory_cache: Dict[int, Dict] = {}

        # 同步状态
        self._sync_status: Dict[int, Dict] = {}

    async def initialize(self):
        """初始化"""
        # TODO: 连接数据库
        logger.info("Memory sync manager initialized")

    async def sync_from_local(
        self,
        teacher_id: int,
        memory_data: Dict
    ) -> Dict:
        """
        从本地同步到云端

        Args:
            teacher_id: 教师 ID
            memory_data: 记忆数据

        Returns:
            同步结果
        """
        # 获取云端现有数据
        existing = await self.get_memory(teacher_id)

        # 合并数据
        merged = self._merge_memory(existing, memory_data)

        # 保存到云端
        success = await self._save_to_cloud(teacher_id, merged)

        if success:
            self._memory_cache[teacher_id] = merged
            self._sync_status[teacher_id] = {
                "last_sync": datetime.now().isoformat(),
                "direction": "upload"
            }

            logger.info(f"Synced memory for teacher {teacher_id}")

            return {
                "success": True,
                "merged": merged
            }

        return {"success": False, "error": "Failed to save"}

    async def sync_to_local(self, teacher_id: int) -> Dict:
        """
        从云端同步到本地

        Args:
            teacher_id: 教师 ID

        Returns:
            记忆数据
        """
        memory = await self.get_memory(teacher_id)

        if memory:
            self._sync_status[teacher_id] = {
                "last_sync": datetime.now().isoformat(),
                "direction": "download"
            }

            return {
                "success": True,
                "memory": memory
            }

        return {"success": False, "error": "No memory data"}

    async def get_memory(self, teacher_id: int) -> Dict:
        """
        获取记忆数据

        Args:
            teacher_id: 教师 ID

        Returns:
            记忆数据
        """
        # 检查缓存
        if teacher_id in self._memory_cache:
            return self._memory_cache[teacher_id]

        # 从云端获取
        memory = await self._load_from_cloud(teacher_id)

        if memory:
            self._memory_cache[teacher_id] = memory

        return memory or {}

    async def update_preference(
        self,
        teacher_id: int,
        key: str,
        value: Any
    ) -> Dict:
        """
        更新偏好

        Args:
            teacher_id: 教师 ID
            key: 偏好键
            value: 值

        Returns:
            更新结果
        """
        memory = await self.get_memory(teacher_id)

        if not memory:
            memory = {"preferences": {}, "habits": {}, "patterns": []}

        memory["preferences"][key] = value
        memory["updated_at"] = datetime.now().isoformat()

        success = await self._save_to_cloud(teacher_id, memory)

        if success:
            self._memory_cache[teacher_id] = memory

            return {"success": True}

        return {"success": False}

    async def record_habit(
        self,
        teacher_id: int,
        action: str,
        details: Dict
    ) -> Dict:
        """
        记录习惯

        Args:
            teacher_id: 教师 ID
            action: 操作
            details: 详情

        Returns:
            结果
        """
        memory = await self.get_memory(teacher_id)

        if not memory:
            memory = {"preferences": {}, "habits": {}, "patterns": []}

        habits = memory.get("habits", {})

        if action not in habits:
            habits[action] = {"count": 0, "history": []}

        habits[action]["count"] += 1
        habits[action]["history"].append({
            "timestamp": datetime.now().isoformat(),
            "details": details
        })

        # 保持最近的 50 条
        if len(habits[action]["history"]) > 50:
            habits[action]["history"] = habits[action]["history"][-50:]

        memory["habits"] = habits

        success = await self._save_to_cloud(teacher_id, memory)

        if success:
            self._memory_cache[teacher_id] = memory

            return {"success": True}

        return {"success": False}

    async def add_pattern(
        self,
        teacher_id: int,
        pattern: Dict
    ) -> Dict:
        """
        添加成功模式

        Args:
            teacher_id: 教师 ID
            pattern: 模式数据

        Returns:
            结果
        """
        memory = await self.get_memory(teacher_id)

        if not memory:
            memory = {"preferences": {}, "habits": {}, "patterns": []}

        patterns = memory.get("patterns", [])

        pattern["added_at"] = datetime.now().isoformat()
        patterns.append(pattern)

        # 保持最近的 20 个
        if len(patterns) > 20:
            patterns = patterns[-20:]

        memory["patterns"] = patterns

        success = await self._save_to_cloud(teacher_id, memory)

        if success:
            self._memory_cache[teacher_id] = memory

            return {"success": True}

        return {"success": False}

    def _merge_memory(self, existing: Dict, new: Dict) -> Dict:
        """
        合并记忆数据

        Args:
            existing: 现有数据
            new: 新数据

        Returns:
            合合后的数据
        """
        merged = {
            "preferences": existing.get("preferences", {}),
            "habits": existing.get("habits", {}),
            "patterns": existing.get("patterns", [])
        }

        # 合并偏好（新值覆盖）
        for key, value in new.get("preferences", {}).items():
            merged["preferences"][key] = value

        # 合并习惯（累计）
        for action, data in new.get("habits", {}).items():
            if action not in merged["habits"]:
                merged["habits"][action] = data
            else:
                merged["habits"][action]["count"] += data.get("count", 0)
                merged["habits"][action]["history"].extend(
                    data.get("history", [])
                )

        # 合并模式（去重）
        for pattern in new.get("patterns", []):
            # 简单去重
            pattern_key = pattern.get("type", "")
            existing_of_type = [
                p for p in merged["patterns"]
                if p.get("type") == pattern_key
            ]

            if not existing_of_type:
                merged["patterns"].append(pattern)

        merged["updated_at"] = datetime.now().isoformat()

        return merged

    async def _load_from_cloud(self, teacher_id: int) -> Optional[Dict]:
        """从云端加载"""
        # TODO: 实际数据库查询
        if self.mcp_client:
            result = await self.mcp_client.call_tool(
                "get_teacher_memory",
                {"teacher_id": teacher_id}
            )

            if result.success:
                return result.result.get("memory", {})

        return None

    async def _save_to_cloud(self, teacher_id: int, memory: Dict) -> bool:
        """保存到云端"""
        # TODO: 实际数据库保存
        if self.mcp_client:
            result = await self.mcp_client.call_tool(
                "update_teacher_memory",
                {
                    "teacher_id": teacher_id,
                    "memory": memory
                }
            )

            return result.success

        # Mock 保存
        return True

    def get_sync_status(self, teacher_id: int) -> Dict:
        """获取同步状态"""
        return self._sync_status.get(teacher_id, {"last_sync": None})

    def clear_cache(self, teacher_id: int = None):
        """清除缓存"""
        if teacher_id:
            if teacher_id in self._memory_cache:
                del self._memory_cache[teacher_id]
        else:
            self._memory_cache = {}

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "cached_users": len(self._memory_cache),
            "synced_users": len(self._sync_status)
        }