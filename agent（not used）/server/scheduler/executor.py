"""
定时任务执行器

执行定时任务的具体逻辑。
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field

logger = logging.getLogger("task_executor")


@dataclass
class TaskExecutionResult:
    """任务执行结果"""
    task_id: int
    success: bool
    result: Dict = field(default_factory=dict)
    error: str = ""
    executed_at: datetime = field(default_factory=datetime.now)


class TaskExecutor:
    """
    定时任务执行器

    功能：
    - 执行任务
    - 调用 MCP 工具
    - 发送通知
    - 记录结果
    """

    def __init__(self, mcp_client=None, push_scheduler=None):
        self.mcp_client = mcp_client
        self.push_scheduler = push_scheduler

        # 执行历史
        self._execution_history: List[TaskExecutionResult] = []

        # 统计
        self._executed_count: int = 0
        self._failed_count: int = 0

        # 回调
        self._on_task_complete: Optional[Callable] = None

    async def execute_task(self, task: Dict) -> TaskExecutionResult:
        """
        执行任务

        Args:
            task: 任务配置

        Returns:
            TaskExecutionResult
        """
        task_id = task.get("id")
        task_type = task.get("task_type")
        action_config = task.get("action_config", {})
        teacher_id = task.get("teacher_id")

        logger.info(f"Executing task {task_id}, type: {task_type}")

        start_time = datetime.now()

        try:
            # 根据任务类型执行
            if task_type == "cron":
                result = await self._execute_cron_task(action_config, teacher_id)

            elif task_type == "condition":
                result = await self._execute_condition_task(action_config, teacher_id)

            elif task_type == "once":
                result = await self._execute_once_task(action_config, teacher_id)

            else:
                result = {"success": False, "error": f"Unknown task type: {task_type}"}

            execution_time = (datetime.now() - start_time).total_seconds()

            # 构建结果
            execution_result = TaskExecutionResult(
                task_id=task_id,
                success=result.get("success", False),
                result=result.get("data", {}),
                error=result.get("error", "")
            )

            # 记录历史
            self._execution_history.append(execution_result)
            self._executed_count += 1

            # 发送通知
            await self._send_notification(task, execution_result)

            # 回调
            if self._on_task_complete:
                await self._on_task_complete(task, execution_result)

            logger.info(f"Task {task_id} completed in {execution_time:.2f}s")

            return execution_result

        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}")

            self._failed_count += 1

            execution_result = TaskExecutionResult(
                task_id=task_id,
                success=False,
                error=str(e)
            )

            self._execution_history.append(execution_result)

            return execution_result

    async def _execute_cron_task(self, action_config: Dict, teacher_id: int) -> Dict:
        """
        执行定时任务

        Args:
            action_config: 操作配置
            teacher_id: 教师 ID

        Returns:
            执行结果
        """
        action_type = action_config.get("action")

        # 每日摘要
        if action_type == "daily_summary":
            return await self._generate_daily_summary(teacher_id)

        # 每周报告
        if action_type == "weekly_report":
            return await self._generate_weekly_report(teacher_id)

        # 数据统计
        if action_type == "data_stats":
            return await self._generate_data_stats(teacher_id)

        # 自定义 MCP 调用
        if action_type == "mcp_call":
            return await self._execute_mcp_call(action_config)

        return {"success": False, "error": f"Unknown action: {action_type}"}

    async def _execute_condition_task(self, action_config: Dict, teacher_id: int) -> Dict:
        """
        执行条件任务

        Args:
            action_config: 操作配置
            teacher_id: 教师 ID

        Returns:
            执行结果
        """
        # 检查条件
        condition_type = action_config.get("condition_type")
        condition_params = action_config.get("condition_params", {})

        # 检查条件是否满足
        condition_met = await self._check_condition(condition_type, condition_params)

        if not condition_met:
            return {"success": True, "data": {"condition_met": False}}

        # 执行动作
        action_type = action_config.get("action")

        if action_type == "send_reminder":
            return await self._send_reminder(action_config, teacher_id)

        if action_type == "notify_teacher":
            return await self._notify_teacher(action_config, teacher_id)

        return {"success": False, "error": f"Unknown action: {action_type}"}

    async def _execute_once_task(self, action_config: Dict, teacher_id: int) -> Dict:
        """
        执行一次性任务

        Args:
            action_config: 操作配置
            teacher_id: 教师 ID

        Returns:
            执行结果
        """
        action_type = action_config.get("action")

        if action_type == "reminder":
            return await self._send_reminder(action_config, teacher_id)

        if action_type == "check_exam":
            return await self._check_exam(action_config, teacher_id)

        return {"success": False, "error": f"Unknown action: {action_type}"}

    async def _generate_daily_summary(self, teacher_id: int) -> Dict:
        """生成每日摘要"""
        # TODO: 从数据库查询统计数据
        stats = {
            "questions_created": 3,
            "exams_created": 1,
            "student_queries": 5,
            "ai_interactions": 15
        }

        return {"success": True, "data": {"stats": stats}}

    async def _generate_weekly_report(self, teacher_id: int) -> Dict:
        """生成每周报告"""
        # TODO: 从数据库查询统计数据
        stats = {
            "questions_created": 15,
            "exams_created": 3,
            "student_queries": 25,
            "ai_interactions": 50,
            "avg_daily_interactions": 10
        }

        return {"success": True, "data": {"stats": stats}}

    async def _generate_data_stats(self, teacher_id: int) -> Dict:
        """生成数据统计"""
        # TODO: 调用 MCP 获取统计
        if self.mcp_client:
            result = await self.mcp_client.call_tool(
                "get_teacher_stats",
                {"teacher_id": teacher_id}
            )

            if result.success:
                return {"success": True, "data": result.result}

        return {"success": True, "data": {}}

    async def _execute_mcp_call(self, action_config: Dict) -> Dict:
        """执行 MCP 调用"""
        tool_name = action_config.get("tool_name")
        params = action_config.get("params", {})

        if self.mcp_client:
            result = await self.mcp_client.call_tool(tool_name, params)

            return {
                "success": result.success,
                "data": result.result,
                "error": result.error
            }

        return {"success": False, "error": "MCP client not available"}

    async def _check_condition(self, condition_type: str, params: Dict) -> bool:
        """检查条件"""
        # 学生连续未提交
        if condition_type == "student_no_submit":
            student_id = params.get("student_id")
            days = params.get("days", 3)

            # TODO: 实际检查
            return False  # 默认不触发

        # 考试即将开始
        if condition_type == "exam_starting":
            exam_id = params.get("exam_id")
            minutes_before = params.get("minutes_before", 30)

            # TODO: 实际检查
            return False

        # 数据量阈值
        if condition_type == "data_threshold":
            threshold = params.get("threshold")

            # TODO: 实际检查
            return False

        return False

    async def _send_reminder(self, action_config: Dict, teacher_id: int) -> Dict:
        """发送提醒"""
        message = action_config.get("message", "提醒")

        if self.push_scheduler:
            task_id = self.push_scheduler.immediate_push(
                teacher_id=teacher_id,
                push_type="reminder",
                content={
                    "reminder_type": "定时提醒",
                    "details": message
                }
            )

            return {"success": True, "data": {"push_task_id": task_id}}

        return {"success": True, "data": {"message": message}}

    async def _notify_teacher(self, action_config: Dict, teacher_id: int) -> Dict:
        """通知教师"""
        message = action_config.get("message")

        if self.push_scheduler:
            task_id = self.push_scheduler.immediate_push(
                teacher_id=teacher_id,
                push_type="custom",
                content={"message": message}
            )

            return {"success": True, "data": {"push_task_id": task_id}}

        return {"success": True}

    async def _check_exam(self, action_config: Dict, teacher_id: int) -> Dict:
        """检查考试"""
        exam_id = action_config.get("exam_id")

        # TODO: 实际检查考试状态
        return {"success": True, "data": {"exam_id": exam_id, "status": "checked"}}

    async def _send_notification(self, task: Dict, result: TaskExecutionResult):
        """发送任务完成通知"""
        notify_channel = task.get("notify_channel", "app")

        if notify_channel == "wechat" and self.push_scheduler:
            message = f"定时任务 #{task['id']} 执行完成"

            if result.success:
                message += " ✅"
            else:
                message += f" ❌\n错误: {result.error}"

            self.push_scheduler.immediate_push(
                teacher_id=task["teacher_id"],
                push_type="custom",
                content={"message": message}
            )

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "executed_count": self._executed_count,
            "failed_count": self._failed_count,
            "success_rate": (self._executed_count - self._failed_count) / max(1, self._executed_count),
            "history_count": len(self._execution_history)
        }

    def get_recent_history(self, limit: int = 10) -> List[TaskExecutionResult]:
        """获取最近执行历史"""
        return self._execution_history[-limit:]

    def set_on_task_complete(self, callback: Callable):
        """设置任务完成回调"""
        self._on_task_complete = callback