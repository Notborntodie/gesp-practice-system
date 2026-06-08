"""
局部记忆存储

存储 Session 内的对话历史、工作流状态、草稿。
不持久化，Session 结束后清除。
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("local_memory")


@dataclass
class ConversationMessage:
    """对话消息"""
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict = field(default_factory=dict)


class LocalMemoryStore:
    """
    局部记忆存储

    功能：
    - 对话历史管理
    - 工作流状态暂存
    - 草稿管理
    - Token 计数
    """

    def __init__(self, max_messages: int = 50):
        self.max_messages = max_messages

        # 对话历史
        self._messages: List[ConversationMessage] = []

        # 当前工作流状态
        self._workflow_state: Dict = {}

        # 草稿
        self._drafts: Dict[str, Any] = {}

        # Token 计数
        self._total_tokens: int = 0

        # 上下文压缩标记
        self._compressed: bool = False
        self._compression_summary: str = ""

    def add_message(
        self,
        role: str,
        content: str,
        metadata: Dict = None
    ) -> ConversationMessage:
        """
        添加消息

        Args:
            role: 角色
            content: 内容
            metadata: 元数据

        Returns:
            消息对象
        """
        message = ConversationMessage(
            role=role,
            content=content,
            metadata=metadata or {}
        )

        self._messages.append(message)

        # Token 计数（粗略）
        self._total_tokens += self._estimate_tokens(content)

        # 限制消息数量
        if len(self._messages) > self.max_messages:
            self._compress_messages()

        return message

    def get_messages(self, limit: int = None) -> List[ConversationMessage]:
        """获取消息列表"""
        if limit:
            return self._messages[-limit:]
        return self._messages.copy()

    def get_last_message(self) -> Optional[ConversationMessage]:
        """获取最后一条消息"""
        if self._messages:
            return self._messages[-1]
        return None

    def get_messages_for_llm(self) -> List[Dict]:
        """
        获取适合 LLM 的消息格式

        Returns:
            格式化的消息列表
        """
        messages = []

        # 如果有压缩摘要，添加为系统消息
        if self._compression_summary:
            messages.append({
                "role": "system",
                "content": f"[对话历史摘要]\n{self._compression_summary}"
            })

        # 添加最近的消息
        for msg in self._messages:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })

        return messages

    def clear_messages(self):
        """清除消息"""
        self._messages = []
        self._total_tokens = 0
        self._compressed = False
        self._compression_summary = ""

    def set_workflow_state(self, key: str, value: Any):
        """设置工作流状态"""
        self._workflow_state[key] = value
        logger.debug(f"Set workflow state: {key}")

    def get_workflow_state(self, key: str) -> Any:
        """获取工作流状态"""
        return self._workflow_state.get(key)

    def get_full_workflow_state(self) -> Dict:
        """获取完整工作流状态"""
        return self._workflow_state.copy()

    def clear_workflow_state(self):
        """清除工作流状态"""
        self._workflow_state = {}

    def save_draft(self, draft_id: str, content: Any):
        """保存草稿"""
        self._drafts[draft_id] = {
            "content": content,
            "saved_at": datetime.now().isoformat()
        }
        logger.info(f"Saved draft: {draft_id}")

    def get_draft(self, draft_id: str) -> Optional[Any]:
        """获取草稿"""
        draft = self._drafts.get(draft_id)
        if draft:
            return draft["content"]
        return None

    def list_drafts(self) -> List[str]:
        """列出草稿"""
        return list(self._drafts.keys())

    def delete_draft(self, draft_id: str):
        """删除草稿"""
        if draft_id in self._drafts:
            del self._drafts[draft_id]
            logger.info(f"Deleted draft: {draft_id}")

    def clear_drafts(self):
        """清除所有草稿"""
        self._drafts = {}

    def _estimate_tokens(self, text: str) -> int:
        """估算 Token 数"""
        if not text:
            return 0

        # 中文约 2 字符/token
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars

        return chinese_chars // 2 + other_chars // 4

    def get_token_count(self) -> int:
        """获取 Token 计数"""
        return self._total_tokens

    def _compress_messages(self):
        """
        压缩消息历史

        当消息过多时，生成摘要并清除旧消息
        """
        # 保留最近的消息
        keep_count = self.max_messages // 2
        old_messages = self._messages[:-keep_count]
        self._messages = self._messages[-keep_count:]

        # 生成压缩摘要（简化版）
        summary_parts = []

        # 用户消息摘要
        user_messages = [m for m in old_messages if m.role == "user"]
        if user_messages:
            summary_parts.append(f"用户请求: {len(user_messages)} 条")

        # 工具调用摘要
        tool_messages = [m for m in old_messages if m.metadata.get("tool_use")]
        if tool_messages:
            tools = [m.metadata.get("tool_use") for m in tool_messages]
            summary_parts.append(f"工具调用: {', '.join(set(tools))}")

        self._compression_summary = "\n".join(summary_parts)
        self._compressed = True

        # 更新 Token 计数
        self._total_tokens = sum(
            self._estimate_tokens(m.content) for m in self._messages
        )
        self._total_tokens += self._estimate_tokens(self._compression_summary)

        logger.info(f"Compressed messages, kept {keep_count}")

    def is_compressed(self) -> bool:
        """是否已压缩"""
        return self._compressed

    def get_summary(self) -> Dict:
        """获取存储摘要"""
        return {
            "message_count": len(self._messages),
            "total_tokens": self._total_tokens,
            "workflow_state_keys": list(self._workflow_state.keys()),
            "draft_count": len(self._drafts),
            "compressed": self._compressed
        }

    def reset(self):
        """完全重置"""
        self.clear_messages()
        self.clear_workflow_state()
        self.clear_drafts()

    def export_session(self) -> Dict:
        """导出 Session 数据"""
        return {
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.timestamp,
                    "metadata": m.metadata
                }
                for m in self._messages
            ],
            "workflow_state": self._workflow_state,
            "drafts": self._drafts,
            "compression_summary": self._compression_summary,
            "exported_at": datetime.now().isoformat()
        }

    def import_session(self, data: Dict):
        """导入 Session 数据"""
        self._messages = [
            ConversationMessage(
                role=m["role"],
                content=m["content"],
                timestamp=m.get("timestamp"),
                metadata=m.get("metadata", {})
            )
            for m in data.get("messages", [])
        ]

        self._workflow_state = data.get("workflow_state", {})
        self._drafts = data.get("drafts", {})
        self._compression_summary = data.get("compression_summary", "")

        # 更新 Token 计数
        self._total_tokens = sum(
            self._estimate_tokens(m.content) for m in self._messages
        )