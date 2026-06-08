"""
Skill 存储

云端 Skill 库的存储管理。
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field

logger = logging.getLogger("skill_storage")


@dataclass
class SkillRecord:
    """Skill 记录"""
    skill_id: str
    name: str
    description: str
    author_id: int
    trigger_keywords: List[str]
    workflow: List[Dict]
    params_template: Dict
    version: int = 1
    use_count: int = 0
    is_public: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class SkillStorage:
    """
    Skill 存储管理

    功能：
    - Skill 存储
    - Skill 查询
    - Skill 版本管理
    """

    def __init__(self, db_config: Dict = None):
        self.db_config = db_config

        # 内存存储（Mock）
        self._skills: Dict[str, SkillRecord] = {}

        # 统计
        self._total_skills: int = 0
        self._public_skills: int = 0

    async def initialize(self):
        """初始化"""
        # TODO: 连接数据库
        logger.info("Skill storage initialized")

    async def save_skill(self, skill: SkillRecord) -> bool:
        """
        保存 Skill

        Args:
            skill: Skill 记录

        Returns:
            是否成功
        """
        skill_id = skill.skill_id

        # 检查是否存在
        if skill_id in self._skills:
            # 更新版本
            existing = self._skills[skill_id]
            skill.version = existing.version + 1
            skill.updated_at = datetime.now()

        self._skills[skill_id] = skill
        self._total_skills += 1

        if skill.is_public:
            self._public_skills += 1

        logger.info(f"Saved skill: {skill_id} v{skill.version}")

        return True

    async def get_skill(self, skill_id: str) -> Optional[SkillRecord]:
        """
        获取 Skill

        Args:
            skill_id: Skill ID

        Returns:
            Skill 记录
        """
        return self._skills.get(skill_id)

    async def get_skill_by_name(self, name: str) -> Optional[SkillRecord]:
        """按名称获取"""
        for skill in self._skills.values():
            if skill.name == name:
                return skill
        return None

    async def list_skills(
        self,
        author_id: int = None,
        is_public: bool = None,
        limit: int = 20
    ) -> List[SkillRecord]:
        """
        列出 Skills

        Args:
            author_id: 作者 ID（可选）
            is_public: 是否公开（可选）
            limit: 数量限制

        Returns:
            Skill 列表
        """
        skills = list(self._skills.values())

        # 筛选
        if author_id:
            skills = [s for s in skills if s.author_id == author_id]

        if is_public is not None:
            skills = [s for s in skills if s.is_public == is_public]

        # 排序（按使用次数）
        skills = sorted(skills, key=lambda s: s.use_count, reverse=True)

        return skills[:limit]

    async def search_skills(self, query: str, limit: int = 10) -> List[SkillRecord]:
        """
        搜索 Skills

        Args:
            query: 搜索关键词
            limit: 数量限制

        Returns:
            Skill 列表
        """
        query_lower = query.lower()
        results = []

        for skill in self._skills.values():
            # 检查名称
            if query_lower in skill.name.lower():
                results.append(skill)
                continue

            # 检查描述
            if query_lower in skill.description.lower():
                results.append(skill)
                continue

            # 检查触发词
            for keyword in skill.trigger_keywords:
                if query_lower in keyword.lower():
                    results.append(skill)
                    break

        # 排序
        results = sorted(results, key=lambda s: s.use_count, reverse=True)

        return results[:limit]

    async def delete_skill(self, skill_id: str) -> bool:
        """
        删除 Skill

        Args:
            skill_id: Skill ID

        Returns:
            是否成功
        """
        if skill_id not in self._skills:
            return False

        skill = self._skills[skill_id]

        if skill.is_public:
            self._public_skills -= 1

        del self._skills[skill_id]
        self._total_skills -= 1

        logger.info(f"Deleted skill: {skill_id}")

        return True

    async def increment_use_count(self, skill_id: str) -> int:
        """
        增加使用计数

        Args:
            skill_id: Skill ID

        Returns:
            新计数
        """
        skill = self._skills.get(skill_id)

        if skill:
            skill.use_count += 1
            return skill.use_count

        return 0

    async def get_popular_skills(self, limit: int = 10) -> List[SkillRecord]:
        """
        获取热门 Skills

        Args:
            limit: 数量限制

        Returns:
            Skill 列表
        """
        skills = sorted(
            [s for s in self._skills.values() if s.is_public],
            key=lambda s: s.use_count,
            reverse=True
        )

        return skills[:limit]

    async def get_skills_by_category(self, category: str) -> List[SkillRecord]:
        """
        按类别获取 Skills

        Args:
            category: 类别

        Returns:
            Skill 列表
        """
        # TODO: 实现类别分类
        return []

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "total_skills": self._total_skills,
            "public_skills": self._public_skills,
            "private_skills": self._total_skills - self._public_skills
        }

    def to_dict(self, skill: SkillRecord) -> Dict:
        """转换为字典"""
        return {
            "skill_id": skill.skill_id,
            "name": skill.name,
            "description": skill.description,
            "author_id": skill.author_id,
            "trigger_keywords": skill.trigger_keywords,
            "workflow": skill.workflow,
            "params_template": skill.params_template,
            "version": skill.version,
            "use_count": skill.use_count,
            "is_public": skill.is_public,
            "created_at": skill.created_at.isoformat(),
            "updated_at": skill.updated_at.isoformat()
        }

    def from_dict(self, data: Dict) -> SkillRecord:
        """从字典创建"""
        return SkillRecord(
            skill_id=data["skill_id"],
            name=data["name"],
            description=data["description"],
            author_id=data["author_id"],
            trigger_keywords=data.get("trigger_keywords", []),
            workflow=data.get("workflow", []),
            params_template=data.get("params_template", {}),
            version=data.get("version", 1),
            use_count=data.get("use_count", 0),
            is_public=data.get("is_public", True),
            created_at=datetime.fromisoformat(data.get("created_at", datetime.now().isoformat())),
            updated_at=datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
        )