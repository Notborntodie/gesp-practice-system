"""
全局记忆存储

存储用户偏好、习惯、订阅的 Skills 等。
通过云端数据库同步。
"""

import logging
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("global_memory")


@dataclass
class UserPreference:
    """用户偏好"""
    style: str = "专业助手"  # 对话风格
    intervention_frequency: str = "normal"  # 干预频率
    question_habits: Dict = field(default_factory=dict)  # 题目创建习惯
    preferred_difficulty: str = "medium"  # 难度偏好
    story_preference: bool = False  # 故事化偏好
    notify_channel: str = "app"  # 通知渠道


class GlobalMemoryStore:
    """
    全局记忆存储

    功能：
    - 用户偏好管理
    - 操作习惯记录
    - Skills 订阅管理
    - 云端同步
    """

    def __init__(self, mcp_client=None, teacher_id: int = None):
        self.mcp_client = mcp_client
        self.teacher_id = teacher_id

        # 本地缓存
        self._preferences: Dict = {}
        self._habits: Dict = {}
        self._patterns: List[Dict] = []
        self._subscribed_skills: List[str] = []
        self._created_skills: List[str] = []

        # 同步状态
        self._last_sync_at: Optional[datetime] = None
        self._dirty: bool = False

    async def initialize(self) -> bool:
        """初始化（从云端加载）"""
        if not self.mcp_client or not self.teacher_id:
            logger.warning("MCP client or teacher_id not set, using defaults")
            self._preferences = self._default_preferences()
            return False

        # 从云端加载
        try:
            result = await self.mcp_client.call_tool(
                "get_teacher_memory",
                {"teacher_id": self.teacher_id}
            )

            if result.success and result.result:
                self._load_from_dict(result.result)
                self._last_sync_at = datetime.now()
                logger.info(f"Loaded memory for teacher {self.teacher_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to load memory: {e}")

        # 使用默认值
        self._preferences = self._default_preferences()
        return False

    def _default_preferences(self) -> Dict:
        """默认偏好"""
        return {
            "style": "专业助手",
            "intervention_frequency": "normal",
            "question_habits": {
                "difficulty": "medium",
                "story_preference": False,
                "test_data_count": 5
            },
            "notify_channel": "app"
        }

    def _load_from_dict(self, data: Dict):
        """从字典加载"""
        self._preferences = data.get("preferences", {})
        self._habits = data.get("habits", {})
        self._patterns = data.get("patterns", [])
        self._subscribed_skills = data.get("subscribed_skills", [])
        self._created_skills = data.get("created_skills", [])

    async def sync_to_cloud(self) -> bool:
        """同步到云端"""
        if not self.mcp_client or not self.teacher_id:
            logger.warning("Cannot sync without MCP client or teacher_id")
            return False

        data = {
            "preferences": self._preferences,
            "habits": self._habits,
            "patterns": self._patterns,
            "subscribed_skills": self._subscribed_skills,
            "created_skills": self._created_skills
        }

        try:
            result = await self.mcp_client.call_tool(
                "update_teacher_memory",
                {
                    "teacher_id": self.teacher_id,
                    "data": data
                }
            )

            if result.success:
                self._last_sync_at = datetime.now()
                self._dirty = False
                logger.info(f"Synced memory for teacher {self.teacher_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to sync memory: {e}")

        return False

    def get_preferences(self) -> Dict:
        """获取偏好"""
        return self._preferences.copy()

    def set_preference(self, key: str, value: Any):
        """设置偏好"""
        self._preferences[key] = value
        self._dirty = True
        logger.info(f"Set preference: {key} = {value}")

    def get_habits(self) -> Dict:
        """获取习惯"""
        return self._habits.copy()

    def record_habit(self, action: str, details: Dict):
        """记录习惯"""
        if action not in self._habits:
            self._habits[action] = {"count": 0, "details": []}

        self._habits[action]["count"] += 1
        self._habits[action]["details"].append({
            "timestamp": datetime.now().isoformat(),
            "details": details
        })

        # 保持最近的 20 条
        if len(self._habits[action]["details"]) > 20:
            self._habits[action]["details"] = self._habits[action]["details"][-20:]

        self._dirty = True

    def get_patterns(self) -> List[Dict]:
        """获取成功模式"""
        return self._patterns.copy()

    def record_pattern(self, pattern: Dict):
        """记录成功模式"""
        pattern["recorded_at"] = datetime.now().isoformat()
        self._patterns.append(pattern)

        # 保持最近的 10 个
        if len(self._patterns) > 10:
            self._patterns = self._patterns[-10:]

        self._dirty = True

    def get_subscribed_skills(self) -> List[str]:
        """获取订阅的 Skills"""
        return self._subscribed_skills.copy()

    def subscribe_skill(self, skill_id: str):
        """订阅 Skill"""
        if skill_id not in self._subscribed_skills:
            self._subscribed_skills.append(skill_id)
            self._dirty = True
            logger.info(f"Subscribed skill: {skill_id}")

    def unsubscribe_skill(self, skill_id: str):
        """取消订阅"""
        if skill_id in self._subscribed_skills:
            self._subscribed_skills.remove(skill_id)
            self._dirty = True
            logger.info(f"Unsubscribed skill: {skill_id}")

    def get_created_skills(self) -> List[str]:
        """获取创建的 Skills"""
        return self._created_skills.copy()

    def record_created_skill(self, skill_id: str):
        """记录创建的 Skill"""
        if skill_id not in self._created_skills:
            self._created_skills.append(skill_id)
            self._dirty = True
            logger.info(f"Recorded created skill: {skill_id}")

    def get_style(self) -> str:
        """获取对话风格"""
        return self._preferences.get("style", "专业助手")

    def set_style(self, style: str):
        """设置对话风格"""
        self.set_preference("style", style)

    def get_intervention_frequency(self) -> str:
        """获取干预频率偏好"""
        return self._preferences.get("intervention_frequency", "normal")

    def is_dirty(self) -> bool:
        """是否需要同步"""
        return self._dirty

    async def auto_sync(self):
        """自动同步（如有变更）"""
        if self._dirty:
            await self.sync_to_cloud()

    def get_summary(self) -> Dict:
        """获取记忆摘要"""
        return {
            "teacher_id": self.teacher_id,
            "preferences": self._preferences,
            "habits_count": len(self._habits),
            "patterns_count": len(self._patterns),
            "subscribed_skills_count": len(self._subscribed_skills),
            "created_skills_count": len(self._created_skills),
            "last_sync_at": self._last_sync_at.isoformat() if self._last_sync_at else None,
            "dirty": self._dirty
        }

    def clear(self):
        """清除记忆"""
        self._preferences = self._default_preferences()
        self._habits = {}
        self._patterns = []
        self._subscribed_skills = []
        self._created_skills = []
        self._dirty = True