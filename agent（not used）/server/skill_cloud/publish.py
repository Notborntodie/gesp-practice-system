"""
Skill 发布

发布 Skill 到云端库。
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

from server.skill_cloud.storage import SkillStorage, SkillRecord

logger = logging.getLogger("skill_publisher")


class SkillPublisher:
    """
    Skill 发布器

    功能：
    - 验证 Skill 结构
    - 发布 Skill
    - 更新 Skill
    """

    def __init__(self, storage: SkillStorage):
        self.storage = storage

        # 发布统计
        self._published_count: int = 0
        self._updated_count: int = 0

    async def publish_skill(
        self,
        author_id: int,
        skill_data: Dict
    ) -> Dict:
        """
        发布 Skill

        Args:
            author_id: 作者 ID
            skill_data: Skill 数据

        Returns:
            发布结果
        """
        # 验证
        validation = self._validate_skill_data(skill_data)

        if not validation["valid"]:
            return {
                "success": False,
                "errors": validation["errors"]
            }

        # 生成 ID
        skill_id = self._generate_skill_id(author_id, skill_data.get("name"))

        # 创建记录
        skill = SkillRecord(
            skill_id=skill_id,
            name=skill_data["name"],
            description=skill_data.get("description", ""),
            author_id=author_id,
            trigger_keywords=skill_data.get("trigger_keywords", []),
            workflow=skill_data.get("workflow", []),
            params_template=skill_data.get("params_template", {}),
            is_public=skill_data.get("is_public", True)
        )

        # 保存
        success = await self.storage.save_skill(skill)

        if success:
            self._published_count += 1

            logger.info(f"Published skill: {skill_id} by author {author_id}")

            return {
                "success": True,
                "skill_id": skill_id,
                "version": skill.version
            }

        return {"success": False, "error": "Failed to save skill"}

    async def update_skill(
        self,
        skill_id: str,
        author_id: int,
        updates: Dict
    ) -> Dict:
        """
        更新 Skill

        Args:
            skill_id: Skill ID
            author_id: 作者 ID
            updates: 更新内容

        Returns:
            更新结果
        """
        # 获取现有 Skill
        skill = await self.storage.get_skill(skill_id)

        if not skill:
            return {"success": False, "error": "Skill not found"}

        # 检查权限
        if skill.author_id != author_id:
            return {"success": False, "error": "Not the author"}

        # 应用更新
        if updates.get("name"):
            skill.name = updates["name"]

        if updates.get("description"):
            skill.description = updates["description"]

        if updates.get("trigger_keywords"):
            skill.trigger_keywords = updates["trigger_keywords"]

        if updates.get("workflow"):
            skill.workflow = updates["workflow"]

        if updates.get("params_template"):
            skill.params_template = updates["params_template"]

        if updates.get("is_public") is not None:
            skill.is_public = updates["is_public"]

        # 保存（会自动更新版本）
        success = await self.storage.save_skill(skill)

        if success:
            self._updated_count += 1

            logger.info(f"Updated skill: {skill_id} to v{skill.version}")

            return {
                "success": True,
                "skill_id": skill_id,
                "version": skill.version
            }

        return {"success": False, "error": "Failed to save"}

    async def unpublish_skill(
        self,
        skill_id: str,
        author_id: int
    ) -> Dict:
        """
        取消发布

        Args:
            skill_id: Skill ID
            author_id: 作者 ID

        Returns:
            结果
        """
        skill = await self.storage.get_skill(skill_id)

        if not skill:
            return {"success": False, "error": "Skill not found"}

        if skill.author_id != author_id:
            return {"success": False, "error": "Not the author"}

        success = await self.storage.delete_skill(skill_id)

        if success:
            logger.info(f"Unpublished skill: {skill_id}")

            return {"success": True}

        return {"success": False, "error": "Failed to delete"}

    def _validate_skill_data(self, data: Dict) -> Dict:
        """
        验证 Skill 数据

        Args:
            data: Skill 数据

        Returns:
            验证结果
        """
        errors = []

        # 必填字段
        if not data.get("name"):
            errors.append("缺少 Skill 名称")

        if not data.get("workflow"):
            errors.append("缺少工作流定义")

        # 验证工作流
        workflow = data.get("workflow", [])
        for i, step in enumerate(workflow):
            if not step.get("action"):
                errors.append(f"步骤 {i+1} 缺少 action")

            if not step.get("name"):
                errors.append(f"步骤 {i+1} 缺少 name")

        # 验证触发词
        if data.get("trigger_keywords"):
            keywords = data["trigger_keywords"]
            if not isinstance(keywords, list):
                errors.append("trigger_keywords 应为列表")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def _generate_skill_id(self, author_id: int, name: str) -> str:
        """
        生成 Skill ID

        Args:
            author_id: 作者 ID
            name: 名称

        Returns:
            Skill ID
        """
        # 基于作者和名称生成
        import hashlib
        base = f"{author_id}_{name}_{datetime.now().timestamp()}"
        hash_part = hashlib.md5(base.encode()).hexdigest()[:8]

        # 清理名称
        clean_name = name.lower().replace(" ", "_").replace("-", "_")[:20]

        return f"skill_{author_id}_{clean_name}_{hash_part}"

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "published_count": self._published_count,
            "updated_count": self._updated_count
        }

    async def get_author_skills(self, author_id: int) -> List[Dict]:
        """
        获取作者的 Skills

        Args:
            author_id: 作者 ID

        Returns:
            Skill 列表
        """
        skills = await self.storage.list_skills(author_id=author_id)

        return [self.storage.to_dict(s) for s in skills]