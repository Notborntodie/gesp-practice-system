"""
企业微信 Bot

用于云端推送提醒、审批通知。
"""

import logging
import httpx
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("wechat_work_bot")


@dataclass
class WechatMessage:
    """微信消息"""
    msgtype: str
    content: Dict = field(default_factory=dict)


class WechatWorkBot:
    """
    企业微信 Bot

    功能：
    - 推送文本消息
    - 推送卡片消息
    - 推送审批通知
    - 推送定时任务结果
    """

    def __init__(self, webhook_url: str = None, corp_id: str = None, secret: str = None):
        self.webhook_url = webhook_url
        self.corp_id = corp_id
        self.secret = secret

        # HTTP Client
        self._client: Optional[httpx.AsyncClient] = None

        # Access Token 缓存
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

        # 消息统计
        self._sent_count: int = 0
        self._error_count: int = 0

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP Client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30)
        return self._client

    async def close(self):
        """关闭 Client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_access_token(self) -> str:
        """获取 Access Token"""
        # 检查缓存
        if self._access_token and self._token_expires_at:
            if datetime.now() < self._token_expires_at:
                return self._access_token

        # 获取新 Token
        client = await self._get_client()

        try:
            response = await client.get(
                "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
                params={
                    "corpid": self.corp_id,
                    "corpsecret": self.secret
                }
            )

            data = response.json()

            if data.get("errcode") == 0:
                self._access_token = data["access_token"]
                # Token 有效期 7200 秒，提前 5 分钟过期
                expires_in = data.get("expires_in", 7200)
                self._token_expires_at = datetime.now() + timedelta(seconds=expires_in - 300)

                logger.info("Got new access token")
                return self._access_token

            else:
                logger.error(f"Failed to get access token: {data}")
                return ""

        except Exception as e:
            logger.error(f"Error getting access token: {e}")
            return ""

    async def send_webhook_message(self, message: WechatMessage) -> Dict:
        """
        通过 Webhook 发送消息

        Args:
            message: 消息对象

        Returns:
            发送结果
        """
        if not self.webhook_url:
            logger.warning("Webhook URL not set")
            return {"success": False, "error": "Webhook URL not set"}

        client = await self._get_client()

        payload = {
            "msgtype": message.msgtype,
            message.msgtype: message.content
        }

        try:
            response = await client.post(
                self.webhook_url,
                json=payload
            )

            data = response.json()

            if data.get("errcode") == 0:
                self._sent_count += 1
                return {"success": True, "msgid": data.get("msgid")}
            else:
                self._error_count += 1
                logger.error(f"Send message failed: {data}")
                return {"success": False, "error": data.get("errmsg")}

        except Exception as e:
            self._error_count += 1
            logger.error(f"Error sending message: {e}")
            return {"success": False, "error": str(e)}

    async def send_text(self, content: str, mentioned_list: List[str] = None) -> Dict:
        """
        发送文本消息

        Args:
            content: 文本内容
            mentioned_list: 提醒人员列表

        Returns:
            发送结果
        """
        message_content = {"content": content}

        if mentioned_list:
            message_content["mentioned_list"] = mentioned_list

        message = WechatMessage(msgtype="text", content=message_content)

        return await self.send_webhook_message(message)

    async def send_markdown(self, content: str) -> Dict:
        """
        发送 Markdown 消息

        Args:
            content: Markdown 内容

        Returns:
            发送结果
        """
        message = WechatMessage(msgtype="markdown", content={"content": content})

        return await self.send_webhook_message(message)

    async def send_card(
        self,
        title: str,
        description: str,
        url: str,
        btntxt: str = "查看详情"
    ) -> Dict:
        """
        发送卡片消息

        Args:
            title: 标题
            description: 描述
            url: 链接
            btntxt: 按钮文本

        Returns:
            发送结果
        """
        message = WechatMessage(
            msgtype="template_card",
            content={
                "card_type": "text_notice",
                "main_title": {"title": title},
                "sub_title_text": description,
                "card_action": {
                    "type": 1,
                    "url": url
                },
                "button_selection": {
                    "text": btntxt
                }
            }
        )

        return await self.send_webhook_message(message)

    async def send_approval_notification(
        self,
        approval_id: int,
        action: str,
        teacher_name: str,
        status: str
    ) -> Dict:
        """
        发送审批通知

        Args:
            approval_id: 审批 ID
            action: 操作类型
            teacher_name: 教师姓名
            status: 审批状态

        Returns:
            发送结果
        """
        content = f"""**审批通知**
> 审批ID: #{approval_id}
> 操作: {action}
> 提交者: {teacher_name}
> 状态: {status}

请及时处理审批请求。"""

        return await self.send_markdown(content)

    async def send_daily_summary(
        self,
        teacher_name: str,
        stats: Dict
    ) -> Dict:
        """
        发送每日摘要

        Args:
            teacher_name: 教师姓名
            stats: 统计数据

        Returns:
            发送结果
        """
        content = f"""**{teacher_name} 的每日摘要**
> 题目创建: {stats.get('questions_created', 0)} 道
> 考试创建: {stats.get('exams_created', 0)} 场
> 学生查询: {stats.get('student_queries', 0)} 次
> AI 交互: {stats.get('ai_interactions', 0)} 次

今日工作完成！"""

        return await self.send_markdown(content)

    async def send_reminder(
        self,
        teacher_name: str,
        reminder_type: str,
        details: str
    ) -> Dict:
        """
        发送提醒

        Args:
            teacher_name: 教师姓名
            reminder_type: 提醒类型
            details: 详情

        Returns:
            发送结果
        """
        content = f"""**{reminder_type}提醒**
{details}

老师您好，请及时处理。"""

        return await self.send_markdown(content)

    async def send_to_user(self, user_id: str, message: WechatMessage) -> Dict:
        """
        发送消息给特定用户（需要 Access Token）

        Args:
            user_id: 用户 ID
            message: 消息对象

        Returns:
            发送结果
        """
        token = await self.get_access_token()
        if not token:
            return {"success": False, "error": "Failed to get access token"}

        client = await self._get_client()

        payload = {
            "touser": user_id,
            "msgtype": message.msgtype,
            message.msgtype: message.content,
            "agentid": 1000001  # 应用 ID
        }

        try:
            response = await client.post(
                "https://qyapi.weixin.qq.com/cgi-bin/message/send",
                params={"access_token": token},
                json=payload
            )

            data = response.json()

            if data.get("errcode") == 0:
                self._sent_count += 1
                return {"success": True}

            else:
                self._error_count += 1
                return {"success": False, "error": data.get("errmsg")}

        except Exception as e:
            self._error_count += 1
            return {"success": False, "error": str(e)}

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "sent_count": self._sent_count,
            "error_count": self._error_count,
            "error_rate": self._error_count / max(1, self._sent_count)
        }

    def test_connection(self) -> Dict:
        """测试连接"""
        return {
            "webhook_set": bool(self.webhook_url),
            "corp_id_set": bool(self.corp_id),
            "secret_set": bool(self.secret)
        }


# 导入 timedelta
from datetime import timedelta