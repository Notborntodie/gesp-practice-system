"""
微信消息处理器

处理接收到的微信消息，转发给 Agent。
"""

import logging
import re
from typing import Dict, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger("wechat_message_handler")


class WechatMessageHandler:
    """
    微信消息处理器

    功能：
    - 解析微信消息
    - 提取命令
    - 转发给 Agent
    - 格式化响应
    """

    # 命令模式
    COMMAND_PATTERNS = {
        "query_student": r"/查询学生\s+(.+)",
        "query_question": r"/查询题目\s+(\S+)\s*(\S*)",
        "create_question": r"/创建题目\s+(.+)",
        "daily_summary": r"/今日摘要",
        "reminders": r"/今日提醒",
        "help": r"/帮助|/help",
        "status": r"/状态"
    }

    def __init__(self, agent=None):
        self.agent = agent

        # 白名单
        self._whitelist: list = []

        # 回调
        self._on_command: Optional[Callable] = None

    def set_agent(self, agent):
        """设置 Agent"""
        self.agent = agent

    def set_whitelist(self, whitelist: list):
        """设置白名单"""
        self._whitelist = whitelist

    def is_whitelisted(self, user_id: str) -> bool:
        """检查白名单"""
        if not self._whitelist:
            return True  # 未设置白名单时全部允许

        return user_id in self._whitelist

    async def handle_message(self, message: Dict) -> Dict:
        """
        处理接收到的消息

        Args:
            message: 微信消息

        Returns:
            响应内容
        """
        # 解析消息
        user_id = message.get("FromUserName", "")
        content = message.get("Content", "")
        msg_type = message.get("MsgType", "text")

        logger.info(f"Received message from {user_id}: {content[:50]}")

        # 检查白名单
        if not self.is_whitelisted(user_id):
            return {
                "type": "text",
                "content": "您不在服务白名单中，请联系管理员添加。"
            }

        # 处理不同消息类型
        if msg_type == "text":
            return await self._handle_text_message(user_id, content)

        elif msg_type == "image":
            return await self._handle_image_message(user_id, message)

        else:
            return {
                "type": "text",
                "content": "暂不支持此类型消息，请发送文字。"
            }

    async def _handle_text_message(self, user_id: str, content: str) -> Dict:
        """处理文本消息"""
        # 检查是否是命令
        command = self._parse_command(content)

        if command:
            return await self._execute_command(user_id, command, content)

        # 作为自然语言输入转发给 Agent
        if self.agent:
            result = await self.agent.process(content, {"user_id": user_id})

            # 格式化响应
            return self._format_agent_response(result)

        # 无 Agent 时的默认响应
        return {
            "type": "text",
            "content": "您好！我是 GESP 智能助手。请发送命令或直接描述您的需求。"
        }

    async def _handle_image_message(self, user_id: str, message: Dict) -> Dict:
        """处理图片消息"""
        # 图片消息暂不处理
        return {
            "type": "text",
            "content": "收到图片，暂不支持图片处理。请发送文字描述。"
        }

    def _parse_command(self, content: str) -> Optional[Dict]:
        """解析命令"""
        for command_type, pattern in self.COMMAND_PATTERNS.items():
            match = re.match(pattern, content.strip())

            if match:
                params = match.groups()

                return {
                    "type": command_type,
                    "params": params,
                    "raw": content
                }

        return None

    async def _execute_command(self, user_id: str, command: Dict, content: str) -> Dict:
        """执行命令"""
        command_type = command["type"]

        if self._on_command:
            return await self._on_command(user_id, command)

        # 默认命令处理
        if command_type == "help":
            return self._get_help_response()

        elif command_type == "status":
            return await self._get_status_response(user_id)

        elif command_type == "daily_summary":
            return await self._get_daily_summary(user_id)

        elif command_type == "query_student":
            student_name = command["params"][0]
            return await self._query_student(student_name, user_id)

        elif command_type == "query_question":
            level = command["params"][0]
            topic = command["params"][1] if len(command["params"]) > 1 else None
            return await self._query_questions(level, topic, user_id)

        elif command_type == "create_question":
            topic = command["params"][0]
            return await self._create_question(topic, user_id)

        else:
            return {
                "type": "text",
                "content": f"未识别的命令: {command_type}"
            }

    def _get_help_response(self) -> Dict:
        """获取帮助响应"""
        help_text = """**GESP Agent 帮助**

可用命令：

/查询学生 姓名 - 查询学生信息
/查询题目 级别 主题 - 查询题目
/创建题目 主题 - 快速创建题目
/今日摘要 - 查看今日工作摘要
/今日提醒 - 查看待办提醒
/状态 - 查看系统状态
/帮助 - 显示帮助

也可以直接发送文字描述您的需求。"""

        return {"type": "text", "content": help_text}

    async def _get_status_response(self, user_id: str) -> Dict:
        """获取状态响应"""
        if self.agent:
            stats = await self.agent.get_stats()

            status_text = f"""**系统状态**

Agent 状态: {stats.get('engine_state', 'unknown')}
初始化: {stats.get('initialized', False)}
可用 Skills: {stats.get('skill_count', 0)}
LLM 请求: {stats.get('llm_stats', {}).get('request_count', 0)}
MCP 请求: {stats.get('mcp_stats', {}).get('call_count', 0)}"""

            return {"type": "text", "content": status_text}

        return {"type": "text", "content": "Agent 未连接"}

    async def _get_daily_summary(self, user_id: str) -> Dict:
        """获取每日摘要"""
        # TODO: 从数据库查询
        summary_text = """**今日摘要**

题目创建: 3 道
考试创建: 1 场
学生查询: 5 次
AI 交互: 15 次

工作完成！"""

        return {"type": "text", "content": summary_text}

    async def _query_student(self, name: str, user_id: str) -> Dict:
        """查询学生"""
        if self.agent:
            result = await self.agent.process(
                f"查询学生 {name}",
                {"user_id": user_id}
            )

            return self._format_agent_response(result)

        return {"type": "text", "content": f"查询学生: {name}"}

    async def _query_questions(self, level: str, topic: str, user_id: str) -> Dict:
        """查询题目"""
        query = f"查询 {level} 级别题目"
        if topic:
            query += f" 主题 {topic}"

        if self.agent:
            result = await self.agent.process(query, {"user_id": user_id})
            return self._format_agent_response(result)

        return {"type": "text", "content": f"查询题目: {level} {topic or ''}"}

    async def _create_question(self, topic: str, user_id: str) -> Dict:
        """创建题目"""
        if self.agent:
            result = await self.agent.process(
                f"创建题目 {topic}",
                {"user_id": user_id}
            )

            return self._format_agent_response(result)

        return {"type": "text", "content": f"创建题目: {topic}"}

    def _format_agent_response(self, result: Dict) -> Dict:
        """格式化 Agent 响应"""
        status = result.get("status")

        if status == "completed":
            responses = result.get("responses", [])
            adapted = result.get("adapted_response", "")

            content = adapted or responses[-1] if responses else "操作完成"

            # 添加步骤信息
            steps = result.get("steps", [])
            if steps:
                content += f"\n\n执行了 {len(steps)} 个步骤"

            return {"type": "text", "content": content}

        elif status == "waiting_approval":
            return {
                "type": "text",
                "content": f"⚠️ 需要审批\n\n{result.get('message', '请等待管理员审批')}"
            }

        elif status == "skill_executed":
            skill_name = result.get("skill", "")
            success = result.get("success")

            if success:
                return {
                    "type": "text",
                    "content": f"✅ Skill {skill_name} 执行成功\n\n{result.get('message', '')}"
                }
            else:
                return {
                    "type": "text",
                    "content": f"❌ Skill {skill_name} 执行失败\n\n{result.get('error', '')}"
                }

        elif status == "error":
            return {
                "type": "text",
                "content": f"❌ 错误\n\n{result.get('message', '未知错误')}"
            }

        return {"type": "text", "content": "处理完成"}