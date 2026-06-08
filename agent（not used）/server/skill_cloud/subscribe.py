"""
Skill 订阅

订阅和使用云端 Skills。
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

from server.skill_cloud.storage import SkillStorage

logger = logging.getLogger("skill_subscriber")


class SkillSubscriber:
    """
    Skill 订阅器

    功能：
    - 搜索 Skills
    - 订阅 Skills
    - 获取订阅列表
    """

    def __init__(self, storage: SkillStorage, mcp_client=None):
        self.storage = storage
        self.mcp_client = mcp_client

        # 用户订阅（Mock）
        self._subscriptions: Dict[int, List[str]] = {}

        # 统计
        self._subscription_count: int = 0

    async def search_skills(self, query: str, limit: int = 10) -> List[Dict]:
        """
        搜索 Skills

        Args:
            query: 搜索关键词
            limit: 数量限制

        Returns:
            Skill 列表
        """
        skills = await self.storage.search_skills(query, limit)

        return [self.storage.to_dict(s) for s in skills]

    async def browse_skills(
        self,
        category: str = None,
        sort_by: str = "popular",
        limit: int = 20
    ) -> List[Dict]:
        """
        浏览 Skills

        Args:
            category: 类别（可选）
            sort_by: 排序方式
            limit: 数量限制

        Returns:
            Skill 列表
        """
        if sort_by == "popular":
            skills = await self.storage.get_popular_skills(limit)
        else:
            skills = await self.storage.list_skills(is_public=True, limit=limit)

        return [self.storage.to_dict(s) for s in skills]

    async def subscribe_skill(self, teacher_id: int, skill_id: str) -> Dict:
        """
        订阅 Skill

        Args:
            teacher_id: 教师 ID
            skill_id: Skill ID

        Returns:
            订阅结果
        """
        # 检查 Skill 是否存在
        skill = await self.storage.get_skill(skill_id)

        if not skill:
            return {"success": False, "error": "Skill not found"}

        # 检查是否已订阅
        if teacher_id not in self._subscriptions:
            self._subscriptions[teacher_id] = []

        if skill_id in self._subscriptions[teacher_id]:
            return {"success": False, "error": "Already subscribed"}

        # 添加订阅
        self._subscriptions[teacher_id].append(skill_id)
        self._subscription_count += 1

        # 增加使用计数
        await self.storage.increment_use_count(skill_id)

        logger.info(f"Teacher {teacher_id} subscribed to {skill_id}")

        return {
            "success": True,
            "skill_id": skill_id,
            "skill_name": skill.name
        }

    async def unsubscribe_skill(self, teacher_id: int, skill_id: str) -> Dict:
        """
        取消订阅

        Args:
            teacher_id: 教师 ID
            skill_id: Skill ID

        Returns:
            结果
        """
        if teacher_id not in self._subscriptions:
            return {"success": False, "error": "No subscriptions"}

        if skill_id not in self._subscriptions[teacher_id]:
            return {"success": False, "error": "Not subscribed"}

        self._subscriptions[teacher_id].remove(skill_id)
        self._subscription_count -= 1

        logger.info(f"Teacher {teacher_id} unsubscribed from {skill_id}")

        return {"success": True}

    async def get_subscriptions(self, teacher_id: int) -> List[Dict]:
        """
        获取订阅列表

        Args:
            teacher_id: 教师 ID

        Returns:
            订阅的 Skill 列表
        """
        skill_ids = self._subscriptions.get(teacher_id, [])

        skills = []
        for skill_id in skill_ids:
            skill = await self.storage.get_skill(skill_id)
            if skill:
                skills.append(self.storage.to_dict(skill))

        return skills

    async def get_skill_details(self, skill_id: str) -> Dict:
        """
        获取 Skill 详情

        Args:
            skill_id: Skill ID

        Returns:
            Skill 详情
        """
        skill = await self.storage.get_skill(skill_id)

        if not skill:
            return {"success": False, "error": "Skill not found"}

        details = self.storage.to_dict(skill)

        # 添加作者信息
        details["author_name"] = f"教师 #{skill.author_id}"

        return {
            "success": True,
            "skill": details
        }

    async def get_recommended_skills(
        self,
        teacher_id: int,
        limit: int = 5
    ) -> List[Dict]:
        """
        获取推荐 Skills

        Args:
            teacher_id: 教师 ID
            limit: 数量限制

        Returns:
            推荐的 Skill 列表
        """
        # 获取已订阅的
        subscribed_ids = self._subscriptions.get(teacher_id, [])

        # 获取热门 Skills（排除已订阅）
        popular = await self.storage.get_popular_skills(limit * 2)

        # 排除已订阅
        recommended = [
            s for s in popular
            if s.skill_id not in subscribed_ids
        ]

        return [self.storage.to_dict(s) for s in recommended[:limit]]

    async def sync_to_local(self, teacher_id: int) -> Dict:
        """
        同步订阅到本地 Agent

        Args:
            teacher_id: 教师 ID

        Returns:
            同步结果
        """
        subscriptions = await self.get_subscriptions(teacher_id)

        if self.mcp_client:
            # 调用 MCP 同步
            result = await self.mcp_client.call_tool(
                "sync_subscribed_skills",
                {
                    "teacher_id": teacher_id,
                    "skills": subscriptions
                }
            )

            if result.success:
                return {
                    "success": True,
                    "synced_count": len(subscriptions)
                }

        # 返回数据供本地处理
        return {
            "success": True,
            "skills": subscriptions,
            "message": "请手动同步到本地"
        }

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "total_subscriptions": self._subscription_count,
            "teachers_with_subscriptions": len(self._subscriptions)
        }

    def get_subscription_count(self, teacher_id: int) -> int:
        """获取用户订阅数量"""
        return len(self._subscriptions.get(teacher_id, []))