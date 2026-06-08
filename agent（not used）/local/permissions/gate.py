"""
权限决策门

实现 4 级权限系统：
1. SAFE - 自由执行
2. MODERATE - 需用户确认
3. HIGH_RISK - 需管理员审批
4. SUPER_HIGH_RISK - 需超级管理员审批

包含资源所有权检查。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime

logger = logging.getLogger("permission_gate")


class PermissionLevel(Enum):
    """权限级别"""
    SAFE = "safe"           # 自由执行
    MODERATE = "moderate"   # 需确认
    HIGH_RISK = "high_risk" # 需管理员审批
    SUPER_HIGH_RISK = "super_high_risk"  # 需超级管理员审批


class ActionType(Enum):
    """操作类型"""
    # SAFE 操作 - 查询
    LIST_QUESTIONS = "list_questions"
    GET_QUESTION = "get_question"
    LIST_EXAMS = "list_exams"
    GET_EXAM = "get_exam"
    LIST_STUDENTS = "list_students"
    GET_STUDENT_PROGRESS = "get_student_progress"
    LIST_LEARNING_PLANS = "list_learning_plans"
    GET_LEARNING_PLAN = "get_learning_plan"

    # SAFE 操作 - 创建
    CREATE_QUESTION = "create_question"
    CREATE_EXAM = "create_exam"
    CREATE_LEARNING_PLAN = "create_learning_plan"

    # MODERATE/HIGH_RISK 操作 - 修改
    UPDATE_QUESTION = "update_question"
    UPDATE_EXAM = "update_exam"
    UPDATE_LEARNING_PLAN = "update_learning_plan"

    # HIGH_RISK/SUPER_HIGH_RISK 操作 - 删除
    DELETE_QUESTION = "delete_question"
    DELETE_EXAM = "delete_exam"
    DELETE_LEARNING_PLAN = "delete_learning_plan"


class RoleType(Enum):
    """角色类型"""
    TEACHER = "teacher"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class PermissionGate:
    """
    权限决策门

    功能：
    - 判断操作权限级别
    - 检查资源所有权
    - 创建审批请求
    - 管理审批状态
    """

    # 基础权限级别映射（不考虑所有权）
    BASE_ACTION_LEVELS = {
        # SAFE
        ActionType.LIST_QUESTIONS: PermissionLevel.SAFE,
        ActionType.GET_QUESTION: PermissionLevel.SAFE,
        ActionType.LIST_EXAMS: PermissionLevel.SAFE,
        ActionType.GET_EXAM: PermissionLevel.SAFE,
        ActionType.LIST_STUDENTS: PermissionLevel.SAFE,
        ActionType.GET_STUDENT_PROGRESS: PermissionLevel.SAFE,
        ActionType.LIST_LEARNING_PLANS: PermissionLevel.SAFE,
        ActionType.GET_LEARNING_PLAN: PermissionLevel.SAFE,
        ActionType.CREATE_QUESTION: PermissionLevel.SAFE,
        ActionType.CREATE_EXAM: PermissionLevel.SAFE,
        ActionType.CREATE_LEARNING_PLAN: PermissionLevel.SAFE,

        # 需根据所有权判断
        ActionType.UPDATE_QUESTION: PermissionLevel.HIGH_RISK,
        ActionType.UPDATE_EXAM: PermissionLevel.HIGH_RISK,
        ActionType.UPDATE_LEARNING_PLAN: PermissionLevel.HIGH_RISK,

        # 删除敏感
        ActionType.DELETE_QUESTION: PermissionLevel.HIGH_RISK,
        ActionType.DELETE_EXAM: PermissionLevel.HIGH_RISK,
        ActionType.DELETE_LEARNING_PLAN: PermissionLevel.HIGH_RISK,
    }

    def __init__(self, approval_manager=None):
        self.approval_manager = approval_manager
        self.user_permissions: Dict[int, Dict] = {}
        self.pending_approvals: Dict[int, Dict] = {}
        self.approval_counter: int = 0

        # 启用所有权检查
        self.has_ownership_check: bool = True

    def get_level(self, action: str, params: Dict, user_id: int = None) -> PermissionLevel:
        """
        获取操作权限级别

        Args:
            action: 操作名称
            params: 操作参数
            user_id: 用户 ID

        Returns:
            PermissionLevel
        """
        # 尝试匹配 ActionType
        try:
            action_type = ActionType(action)
        except ValueError:
            # 未知操作，默认 MODERATE
            return PermissionLevel.MODERATE

        base_level = self.BASE_ACTION_LEVELS.get(action_type, PermissionLevel.MODERATE)

        # 如果不是 SAFE 操作，检查所有权
        if base_level != PermissionLevel.SAFE and self.has_ownership_check:
            level = self._adjust_level_by_ownership(action_type, params, user_id)
            return level

        return base_level

    def _adjust_level_by_ownership(
        self,
        action_type: ActionType,
        params: Dict,
        user_id: int
    ) -> PermissionLevel:
        """
        根据所有权调整权限级别

        规则：
        - 自己的资源：MODERATE（需确认）
        - 他人的资源：HIGH_RISK 或 SUPER_HIGH_RISK
        - 超级管理员：降级权限
        """
        base_level = self.BASE_ACTION_LEVELS.get(action_type)

        # 检查超级管理员
        user_perms = self.user_permissions.get(user_id, {})
        if user_perms.get("is_super_admin"):
            # 超级管理员权限降级
            if base_level == PermissionLevel.SUPER_HIGH_RISK:
                return PermissionLevel.MODERATE
            return PermissionLevel.SAFE

        # 获取资源所有者
        owner_id = params.get("owner_id")

        if owner_id is None:
            # 无法确定所有者，保持基础级别
            return base_level

        if owner_id == user_id:
            # 自己的资源
            if action_type in [ActionType.DELETE_QUESTION, ActionType.DELETE_EXAM]:
                # 删除自己的资源仍需审批（防止误删）
                return PermissionLevel.HIGH_RISK
            else:
                # 修改自己的资源只需确认
                return PermissionLevel.MODERATE

        # 他人的资源
        if action_type in [ActionType.DELETE_QUESTION, ActionType.DELETE_EXAM]:
            # 删除他人的资源需超级管理员审批
            return PermissionLevel.SUPER_HIGH_RISK
        else:
            # 修改他人的资源需管理员审批
            return PermissionLevel.HIGH_RISK

    async def check(self, action: str, params: Dict, user_id: int = None) -> Dict:
        """
        检查权限

        Args:
            action: 操作名称
            params: 操作参数
            user_id: 用户 ID

        Returns:
            权限决策结果
        """
        level = self.get_level(action, params, user_id)

        decision = {
            "action": action,
            "level": level.value,
            "params": params,
            "user_id": user_id
        }

        if level == PermissionLevel.SAFE:
            decision["allowed"] = True
            decision["need_approval"] = False
            decision["need_confirm"] = False

        elif level == PermissionLevel.MODERATE:
            decision["allowed"] = True
            decision["need_approval"] = False
            decision["need_confirm"] = True
            decision["confirm_message"] = f"请确认执行操作: {action}"

        elif level == PermissionLevel.HIGH_RISK:
            decision["allowed"] = False
            decision["need_approval"] = True
            decision["approval_type"] = "admin"
            decision["approval_reason"] = f"敏感操作需要管理员审批: {action}"

        elif level == PermissionLevel.SUPER_HIGH_RISK:
            decision["allowed"] = False
            decision["need_approval"] = True
            decision["approval_type"] = "super_admin"
            decision["approval_reason"] = f"敏感操作需要超级管理员审批: {action}"

        return decision

    async def request_approval(
        self,
        user_id: int,
        action: str,
        params: Dict,
        reason: str = None
    ) -> Dict:
        """
        请求审批

        Args:
            user_id: 用户 ID
            action: 操作名称
            params: 操作参数
            reason: 申请原因

        Returns:
            审批请求结果
        """
        self.approval_counter += 1

        approval = {
            "id": self.approval_counter,
            "user_id": user_id,
            "action": action,
            "params": params,
            "reason": reason,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "approved_at": None,
            "admin_id": None,
            "approval_type": "admin"
        }

        # 根据操作确定审批类型
        level = self.get_level(action, params, user_id)
        if level == PermissionLevel.SUPER_HIGH_RISK:
            approval["approval_type"] = "super_admin"

        self.pending_approvals[self.approval_counter] = approval

        logger.info(f"Created approval request #{self.approval_counter}: {action} by user {user_id}")

        return {
            "approval_id": self.approval_counter,
            "status": "pending",
            "approval_type": approval["approval_type"],
            "message": f"审批请求已提交，ID: {self.approval_counter}"
        }

    async def check_approval_status(self, approval_id: int) -> Dict:
        """
        检查审批状态

        Args:
            approval_id: 审批 ID

        Returns:
            审批状态
        """
        approval = self.pending_approvals.get(approval_id)

        if not approval:
            return {"status": "not_found", "approval_id": approval_id}

        return {
            "approval_id": approval_id,
            "status": approval["status"],
            "action": approval["action"],
            "params": approval["params"],
            "created_at": approval["created_at"],
            "approved_at": approval.get("approved_at"),
            "admin_id": approval.get("admin_id")
        }

    def set_user_permission(self, user_id: int, permissions: Dict):
        """
        设置用户权限

        Args:
            user_id: 用户 ID
            permissions: 权限配置
        """
        self.user_permissions[user_id] = permissions

        # 如果设置超级管理员，更新标记
        if permissions.get("is_super_admin"):
            logger.info(f"User {user_id} set as super admin")

    def get_user_permission(self, user_id: int) -> Dict:
        """
        获取用户权限配置

        Args:
            user_id: 用户 ID

        Returns:
            权限配置
        """
        return self.user_permissions.get(user_id, {
            "role": RoleType.TEACHER.value,
            "is_admin": False,
            "is_super_admin": False
        })

    async def approve_request(self, approval_id: int, admin_id: int, reason: str = "") -> Dict:
        """
        批准审批请求

        Args:
            approval_id: 审批 ID
            admin_id: 管理员 ID
            reason: 批准原因

        Returns:
            批准结果
        """
        approval = self.pending_approvals.get(approval_id)

        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "pending":
            return {"success": False, "error": f"审批已处理，状态: {approval['status']}"}

        # 检查审批类型
        if approval["approval_type"] == "super_admin":
            admin_perms = self.user_permissions.get(admin_id, {})
            if not admin_perms.get("is_super_admin"):
                return {"success": False, "error": "需要超级管理员审批"}

        # 检查审批者不是请求发起者
        if admin_id == approval["user_id"]:
            return {"success": False, "error": "不能审批自己的请求"}

        approval["status"] = "approved"
        approval["admin_id"] = admin_id
        approval["approval_reason"] = reason
        approval["approved_at"] = datetime.now().isoformat()

        logger.info(f"Approval #{approval_id} approved by admin {admin_id}")

        return {
            "success": True,
            "status": "approved",
            "approval_id": approval_id,
            "executed": False,  # 需教师二次确认
            "need_teacher_confirm": True
        }

    async def reject_request(self, approval_id: int, admin_id: int, reason: str = "") -> Dict:
        """
        拒绝审批请求

        Args:
            approval_id: 审批 ID
            admin_id: 管理员 ID
            reason: 拒绝原因

        Returns:
            拒绝结果
        """
        approval = self.pending_approvals.get(approval_id)

        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "pending":
            return {"success": False, "error": f"审批已处理，状态: {approval['status']}"}

        approval["status"] = "rejected"
        approval["admin_id"] = admin_id
        approval["rejection_reason"] = reason
        approval["rejected_at"] = datetime.now().isoformat()

        logger.info(f"Approval #{approval_id} rejected by admin {admin_id}")

        return {
            "success": True,
            "status": "rejected",
            "approval_id": approval_id,
            "reason": reason
        }

    async def teacher_confirm(self, approval_id: int, teacher_id: int) -> Dict:
        """
        教师二次确认

        Args:
            approval_id: 审批 ID
            teacher_id: 教师 ID

        Returns:
            确认结果
        """
        approval = self.pending_approvals.get(approval_id)

        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "approved":
            return {"success": False, "error": "审批未批准"}

        if approval["user_id"] != teacher_id:
            return {"success": False, "error": "不是您的审批"}

        approval["teacher_confirmed"] = True
        approval["confirmed_at"] = datetime.now().isoformat()
        approval["status"] = "executed"

        logger.info(f"Approval #{approval_id} confirmed by teacher {teacher_id}")

        return {
            "success": True,
            "status": "executed",
            "approval_id": approval_id,
            "action": approval["action"],
            "params": approval["params"]
        }

    def get_pending_approvals(self, approval_type: str = None) -> List[Dict]:
        """
        获取待审批列表

        Args:
            approval_type: 审批类型筛选

        Returns:
            待审批列表
        """
        pending = [
            a for a in self.pending_approvals.values()
            if a["status"] == "pending"
        ]

        if approval_type:
            pending = [a for a in pending if a["approval_type"] == approval_type]

        return pending

    def get_user_approvals(self, user_id: int) -> List[Dict]:
        """
        获取用户的审批请求

        Args:
            user_id: 用户 ID

        Returns:
            用户审批列表
        """
        return [
            a for a in self.pending_approvals.values()
            if a["user_id"] == user_id
        ]

    def clear_expired_approvals(self, max_age_hours: int = 48) -> int:
        """
        清除过期审批

        Args:
            max_age_hours: 最大保留时间（小时）

        Returns:
            清除数量
        """
        from datetime import timedelta

        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        cleared = 0

        for approval_id, approval in list(self.pending_approvals.items()):
            created = datetime.fromisoformat(approval["created_at"])
            if created < cutoff and approval["status"] == "pending":
                approval["status"] = "expired"
                approval["expired_at"] = datetime.now().isoformat()
                cleared += 1

        logger.info(f"Cleared {cleared} expired approvals")
        return cleared