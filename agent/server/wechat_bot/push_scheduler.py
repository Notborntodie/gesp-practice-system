"""
推送调度器

管理定时推送任务。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field

logger = logging.getLogger("push_scheduler")


@dataclass
class PushTask:
    """推送任务"""
    task_id: str
    teacher_id: int
    push_type: str  # daily_summary, reminder, approval_notice
    schedule_time: datetime
    content: Dict = field(default_factory=dict)
    channel: str = "wechat"  # wechat, app
    status: str = "pending"
    created_at: datetime = field(default_factory=datetime.now)


class PushScheduler:
    """
    推送调度器

    功能：
    - 创建推送任务
    - 定时执行推送
    - 推送结果跟踪
    """

    def __init__(self, wechat_bot=None):
        self.wechat_bot = wechat_bot

        # 任务列表
        self._tasks: Dict[str, PushTask] = {}
        self._task_counter: int = 0

        # 调度状态
        self._running: bool = False
        self._scheduler_task: Optional[asyncio.Task] = None

        # 回调
        self._on_push_complete: Optional[Callable] = None

    async def start(self):
        """启动调度器"""
        if self._running:
            logger.warning("Scheduler already running")
            return

        self._running = True
        self._scheduler_task = asyncio.create_task(self._schedule_loop())

        logger.info("Push scheduler started")

    async def stop(self):
        """停止调度器"""
        self._running = False

        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass

        logger.info("Push scheduler stopped")

    async def _schedule_loop(self):
        """调度循环"""
        while self._running:
            try:
                # 检查待执行任务
                now = datetime.now()

                for task_id, task in list(self._tasks.items()):
                    if task.status == "pending" and task.schedule_time <= now:
                        await self._execute_push(task)

                # 清理已完成任务（超过 1 小时）
                cleanup_time = now - timedelta(hours=1)
                for task_id, task in list(self._tasks.items()):
                    if task.status == "completed" and task.created_at < cleanup_time:
                        del self._tasks[task_id]

                # 等待下一次检查
                await asyncio.sleep(60)  # 每分钟检查一次

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)

    def create_push_task(
        self,
        teacher_id: int,
        push_type: str,
        schedule_time: datetime,
        content: Dict,
        channel: str = "wechat"
    ) -> str:
        """
        创建推送任务

        Args:
            teacher_id: 教师 ID
            push_type: 推送类型
            schedule_time: 推送时间
            content: 推送内容
            channel: 推送渠道

        Returns:
            任务 ID
        """
        self._task_counter += 1
        task_id = f"push_{self._task_counter}"

        task = PushTask(
            task_id=task_id,
            teacher_id=teacher_id,
            push_type=push_type,
            schedule_time=schedule_time,
            content=content,
            channel=channel
        )

        self._tasks[task_id] = task

        logger.info(f"Created push task {task_id} for teacher {teacher_id}")

        return task_id

    async def _execute_push(self, task: PushTask):
        """执行推送"""
        logger.info(f"Executing push task {task.task_id}")

        task.status = "executing"

        try:
            if task.channel == "wechat" and self.wechat_bot:
                result = await self._push_to_wechat(task)
            else:
                result = {"success": False, "error": "No push channel available"}

            task.status = "completed"
            task.content["result"] = result

            if self._on_push_complete:
                await self._on_push_complete(task, result)

            logger.info(f"Push task {task.task_id} completed: {result}")

        except Exception as e:
            task.status = "failed"
            task.content["error"] = str(e)

            logger.error(f"Push task {task.task_id} failed: {e}")

    async def _push_to_wechat(self, task: PushTask) -> Dict:
        """推送到微信"""
        push_type = task.push_type
        content = task.content

        if push_type == "daily_summary":
            return await self.wechat_bot.send_daily_summary(
                content.get("teacher_name", ""),
                content.get("stats", {})
            )

        elif push_type == "reminder":
            return await self.wechat_bot.send_reminder(
                content.get("teacher_name", ""),
                content.get("reminder_type", ""),
                content.get("details", "")
            )

        elif push_type == "approval_notice":
            return await self.wechat_bot.send_approval_notification(
                content.get("approval_id", 0),
                content.get("action", ""),
                content.get("teacher_name", ""),
                content.get("status", "")
            )

        elif push_type == "custom":
            return await self.wechat_bot.send_markdown(content.get("message", ""))

        else:
            return {"success": False, "error": f"Unknown push type: {push_type}"}

    def schedule_daily_summary(
        self,
        teacher_id: int,
        teacher_name: str,
        time: str = "20:00"
    ) -> str:
        """
        安排每日摘要

        Args:
            teacher_id: 教师 ID
            teacher_name: 教师姓名
            time: 推送时间（HH:MM）

        Returns:
            任务 ID
        """
        # 计算下一次推送时间
        now = datetime.now()
        hour, minute = map(int, time.split(":"))

        schedule_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

        if schedule_time <= now:
            schedule_time += timedelta(days=1)

        return self.create_push_task(
            teacher_id=teacher_id,
            push_type="daily_summary",
            schedule_time=schedule_time,
            content={"teacher_name": teacher_name, "stats": {}},
            channel="wechat"
        )

    def schedule_reminder(
        self,
        teacher_id: int,
        teacher_name: str,
        reminder_type: str,
        details: str,
        schedule_time: datetime
    ) -> str:
        """
        安排提醒

        Args:
            teacher_id: 教师 ID
            teacher_name: 教师姓名
            reminder_type: 提醒类型
            details: 详情
            schedule_time: 提醒时间

        Returns:
            任务 ID
        """
        return self.create_push_task(
            teacher_id=teacher_id,
            push_type="reminder",
            schedule_time=schedule_time,
            content={
                "teacher_name": teacher_name,
                "reminder_type": reminder_type,
                "details": details
            },
            channel="wechat"
        )

    def immediate_push(
        self,
        teacher_id: int,
        push_type: str,
        content: Dict,
        channel: str = "wechat"
    ) -> str:
        """
        立即推送

        Args:
            teacher_id: 教师 ID
            push_type: 推送类型
            content: 内容
            channel: 渠道

        Returns:
            任务 ID
        """
        return self.create_push_task(
            teacher_id=teacher_id,
            push_type=push_type,
            schedule_time=datetime.now(),
            content=content,
            channel=channel
        )

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self._tasks.get(task_id)

        if task and task.status in ["pending"]:
            task.status = "cancelled"
            logger.info(f"Cancelled push task {task_id}")
            return True

        return False

    def get_task(self, task_id: str) -> Optional[PushTask]:
        """获取任务"""
        return self._tasks.get(task_id)

    def get_pending_tasks(self, teacher_id: int = None) -> List[PushTask]:
        """获取待执行任务"""
        pending = [t for t in self._tasks.values() if t.status == "pending"]

        if teacher_id:
            pending = [t for t in pending if t.teacher_id == teacher_id]

        return pending

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "total_tasks": len(self._tasks),
            "pending": len([t for t in self._tasks.values() if t.status == "pending"]),
            "completed": len([t for t in self._tasks.values() if t.status == "completed"]),
            "failed": len([t for t in self._tasks.values() if t.status == "failed"]),
            "running": self._running
        }

    def set_on_push_complete(self, callback: Callable):
        """设置推送完成回调"""
        self._on_push_complete = callback