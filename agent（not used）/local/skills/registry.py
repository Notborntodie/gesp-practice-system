"""
Skill 注册表

管理所有 Skill 的注册、查找、匹配。
"""

import logging
from typing import Dict, List, Any, Optional
from local.skills.base import SkillBase

logger = logging.getLogger("skill_registry")


class SkillRegistry:
    """
    Skill 注册表

    功能：
    - Skill 注册
    - 按名称/ID 查找
    - 按触发词匹配
    - Skills 列表管理
    """

    def __init__(self):
        self._skills: Dict[str, SkillBase] = {}
        self._keyword_map: Dict[str, List[str]] = {}  # keyword -> skill_ids
        self._categories: Dict[str, List[str]] = {}  # category -> skill_ids

    def register(self, skill: SkillBase) -> bool:
        """
        注册 Skill

        Args:
            skill: Skill 实例

        Returns:
            是否成功
        """
        if skill.skill_id in self._skills:
            logger.warning(f"Skill {skill.skill_id} already registered")
            return False

        self._skills[skill.skill_id] = skill

        # 建立触发词映射
        for keyword in skill.trigger_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower not in self._keyword_map:
                self._keyword_map[keyword_lower] = []
            self._keyword_map[keyword_lower].append(skill.skill_id)

        logger.info(f"Registered skill: {skill.skill_id} - {skill.name}")
        return True

    def unregister(self, skill_id: str) -> bool:
        """
        取消注册

        Args:
            skill_id: Skill ID

        Returns:
            是否成功
        """
        if skill_id not in self._skills:
            return False

        skill = self._skills[skill_id]

        # 清除触发词映射
        for keyword in skill.trigger_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in self._keyword_map:
                if skill_id in self._keyword_map[keyword_lower]:
                    self._keyword_map[keyword_lower].remove(skill_id)
                if not self._keyword_map[keyword_lower]:
                    del self._keyword_map[keyword_lower]

        del self._skills[skill_id]
        logger.info(f"Unregistered skill: {skill_id}")
        return True

    def get(self, skill_id: str) -> Optional[SkillBase]:
        """按 ID 获取 Skill"""
        return self._skills.get(skill_id)

    def get_by_name(self, name: str) -> Optional[SkillBase]:
        """按名称获取 Skill"""
        for skill in self._skills.values():
            if skill.name == name:
                return skill
        return None

    def match_by_trigger(self, text: str) -> List[SkillBase]:
        """
        根据触发词匹配

        Args:
            text: 输入文本

        Returns:
            匹配的 Skill 列表
        """
        matched_ids = set()
        text_lower = text.lower()

        # 检查每个触发词
        for keyword, skill_ids in self._keyword_map.items():
            if keyword in text_lower:
                matched_ids.update(skill_ids)

        # 返回匹配的 Skill
        return [self._skills[id] for id in matched_ids if id in self._skills]

    def get_best_match(self, text: str) -> Optional[SkillBase]:
        """
        获取最佳匹配

        Args:
            text: 输入文本

        Returns:
            最佳匹配的 Skill
        """
        matches = self.match_by_trigger(text)

        if not matches:
            return None

        # 选择使用次数最多的（更成熟的）
        return max(matches, key=lambda s: s.use_count)

    def list_all(self) -> List[SkillBase]:
        """列出所有 Skill"""
        return list(self._skills.values())

    def list_by_category(self, category: str) -> List[SkillBase]:
        """按类别列出"""
        skill_ids = self._categories.get(category, [])
        return [self._skills[id] for id in skill_ids if id in self._skills]

    def get_count(self) -> int:
        """获取 Skill 数量"""
        return len(self._skills)

    def get_trigger_keywords(self) -> List[str]:
        """获取所有触发词"""
        return list(self._keyword_map.keys())

    def search(self, query: str) -> List[SkillBase]:
        """
        搜索 Skill

        Args:
            query: 搜索关键词

        Returns:
            匹配的 Skill 列表
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

        return results

    def get_summary(self) -> Dict:
        """获取注册表摘要"""
        return {
            "skill_count": len(self._skills),
            "keyword_count": len(self._keyword_map),
            "skills": [
                {
                    "id": s.skill_id,
                    "name": s.name,
                    "use_count": s.use_count
                }
                for s in self._skills.values()
            ]
        }

    def clear(self):
        """清除所有注册"""
        self._skills = {}
        self._keyword_map = {}
        self._categories = {}

    def import_from_dict(self, skills_data: List[Dict]):
        """
        从字典导入 Skills

        Args:
            skills_data: Skills 数据列表
        """
        # TODO: 实现从字典创建 Skill 实例
        pass

    def export_to_dict(self) -> List[Dict]:
        """
        导出为字典

        Returns:
            Skills 数据列表
        """
        return [skill.get_info() for skill in self._skills.values()]