"""
定时任务管理器
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger("task_manager")


class TaskManager:
    """定时任务管理器"""

    def __init__(self):
        self._tasks: Dict[int, Dict] = {}
        self._counter = 0
        self._running = False

    async def initialize(self):
        """初始化"""
        logger.info("任务管理器初始化完成")
        # TODO: 加载现有任务

    async def create_task(
        self,
        teacher_id: int,
        task_name: str,
        task_type: str,
        schedule_config: Dict,
        action_config: Dict,
        notify_channel: str = "app"
    ) -> int:
        """创建任务"""
        self._counter += 1

        task = {
            "id": self._counter,
            "teacher_id": teacher_id,
            "task_name": task_name,
            "task_type": task_type,  # cron/condition/once
            "schedule_config": schedule_config,
            "action_config": action_config,
            "notify_channel": notify_channel,
            "is_active": True,
            "created_at": datetime.now().isoformat()
        }

        self._tasks[self._counter] = task

        return self._counter

    async def list_tasks(self, teacher_id: int = None) -> List[Dict]:
        """列出任务"""
        if teacher_id:
            return [t for t in self._tasks.values() if t["teacher_id"] == teacher_id]
        return list(self._tasks.values())

    async def cancel_task(self, task_id: int) -> bool:
        """取消任务"""
        task = self._tasks.get(task_id)
        if task:
            task["is_active"] = False
            return True
        return False

    async def shutdown(self):
        """关闭"""
        self._running = False
        logger.info("任务管理器关闭")