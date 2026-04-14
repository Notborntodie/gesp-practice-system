"""
审批管理器

处理审批请求的创建、查询、审批、拒绝。
"""

import logging
import json
from datetime import datetime
from typing import Dict, Optional, List

logger = logging.getLogger("approval_manager")


class ApprovalManager:
    """审批管理器"""

    def __init__(self, db_config: Dict = None):
        self.db_config = db_config
        self._approvals: Dict[int, Dict] = {}  # Mock 存储
        self._counter = 0

    async def initialize(self):
        """初始化"""
        # TODO: 连接数据库
        logger.info("审批管理器初始化完成")

    async def create_request(
        self,
        teacher_id: int,
        action: str,
        resource_type: str = None,
        resource_id: int = None,
        params: dict = None
    ) -> int:
        """创建审批请求"""
        self._counter += 1

        approval = {
            "id": self._counter,
            "teacher_id": teacher_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "params": params or {},
            "status": "pending",
            "admin_id": None,
            "reason": None,
            "teacher_confirmed": False,
            "created_at": datetime.now().isoformat(),
            "approved_at": None,
            "executed_at": None
        }

        self._approvals[self._counter] = approval

        logger.info(f"创建审批请求 #{self._counter}: {action} by teacher {teacher_id}")

        return self._counter

    async def get_request(self, approval_id: int) -> Optional[Dict]:
        """获取审批详情"""
        return self._approvals.get(approval_id)

    async def get_pending_requests(self) -> List[Dict]:
        """获取待审批列表"""
        return [
            a for a in self._approvals.values()
            if a["status"] == "pending"
        ]

    async def approve(
        self,
        approval_id: int,
        admin_id: int,
        reason: str = ""
    ) -> Dict:
        """批准"""
        approval = self._approvals.get(approval_id)
        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "pending":
            return {"success": False, "error": "审批已处理"}

        approval["status"] = "approved"
        approval["admin_id"] = admin_id
        approval["reason"] = reason
        approval["approved_at"] = datetime.now().isoformat()

        logger.info(f"审批 #{approval_id} 已批准 by admin {admin_id}")

        # 通知教师确认
        # TODO: 推送通知

        return {
            "success": True,
            "status": "approved",
            "approval_id": approval_id,
            "need_teacher_confirm": True
        }

    async def reject(
        self,
        approval_id: int,
        admin_id: int,
        reason: str = ""
    ) -> Dict:
        """拒绝"""
        approval = self._approvals.get(approval_id)
        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "pending":
            return {"success": False, "error": "审批已处理"}

        approval["status"] = "rejected"
        approval["admin_id"] = admin_id
        approval["reason"] = reason

        logger.info(f"审批 #{approval_id} 已拒绝 by admin {admin_id}")

        return {
            "success": True,
            "status": "rejected",
            "approval_id": approval_id
        }

    async def teacher_confirm(self, approval_id: int, teacher_id: int) -> Dict:
        """教师二次确认"""
        approval = self._approvals.get(approval_id)
        if not approval:
            return {"success": False, "error": "审批不存在"}

        if approval["status"] != "approved":
            return {"success": False, "error": "审批未批准"}

        if approval["teacher_id"] != teacher_id:
            return {"success": False, "error": "不是您的审批"}

        approval["teacher_confirmed"] = True

        # 执行操作
        result = await self._execute_action(approval)

        approval["executed_at"] = datetime.now().isoformat()

        return {
            "success": True,
            "executed": result["success"],
            "approval_id": approval_id
        }

    async def _execute_action(self, approval: Dict) -> Dict:
        """执行审批后的操作"""
        action = approval["action"]
        params = approval["params"]

        # 根据操作类型执行
        # TODO: 实现真实执行

        logger.info(f"执行审批操作: {action}")

        return {"success": True}

    async def shutdown(self):
        """关闭"""
        logger.info("审批管理器关闭")