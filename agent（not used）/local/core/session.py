"""
Session 管理
"""

import logging
import uuid
from typing import Dict, Optional, List, Any
from datetime import datetime
from enum import Enum

logger = logging.getLogger("session_manager")


class SessionStatus(Enum):
    """Session 状态"""
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    ERROR = "error"


class SessionManager:
    """Session 管理器"""

    def __init__(self):
        self._current_session: Optional[Dict] = None
        self._session_history: List[Dict] = []
        self._max_history: int = 100

    def start_session(self, workflow_type: str = None) -> str:
        """开始新 Session"""
        session_id = str(uuid.uuid4())

        self._current_session = {
            "id": session_id,
            "status": SessionStatus.ACTIVE.value,
            "workflow_type": workflow_type,
            "messages": [],
            "steps": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "summary": None,
            "success": None
        }

        logger.info(f"Session started: {session_id}")
        return session_id

    def end_session(self, success: bool = True, summary: Dict = None) -> Optional[str]:
        """结束当前 Session"""
        if not self._current_session:
            logger.warning("No active session to end")
            return None

        session_id = self._current_session["id"]
        self._current_session["status"] = SessionStatus.COMPLETED.value
        self._current_session["success"] = success
        self._current_session["summary"] = summary
        self._current_session["ended_at"] = datetime.now().isoformat()

        # 归档到历史
        self._session_history.append(self._current_session)

        # 清理历史（保持上限）
        if len(self._session_history) > self._max_history:
            self._session_history = self._session_history[-self._max_history:]

        logger.info(f"Session ended: {session_id}, success={success}")

        self._current_session = None
        return session_id

    def pause_session(self) -> bool:
        """暂停当前 Session"""
        if not self._current_session:
            return False

        if self._current_session["status"] != SessionStatus.ACTIVE.value:
            return False

        self._current_session["status"] = SessionStatus.PAUSED.value
        self._current_session["paused_at"] = datetime.now().isoformat()
        logger.info(f"Session paused: {self._current_session['id']}")
        return True

    def resume_session(self) -> bool:
        """恢复暂停的 Session"""
        if not self._current_session:
            return False

        if self._current_session["status"] != SessionStatus.PAUSED.value:
            return False

        self._current_session["status"] = SessionStatus.ACTIVE.value
        self._current_session["resumed_at"] = datetime.now().isoformat()
        logger.info(f"Session resumed: {self._current_session['id']}")
        return True

    def load_session(self, session_id: str) -> Optional[Dict]:
        """加载历史 Session"""
        # 先检查当前
        if self._current_session and self._current_session["id"] == session_id:
            return self._current_session

        # 搜索历史
        for session in self._session_history:
            if session["id"] == session_id:
                return session

        logger.warning(f"Session not found: {session_id}")
        return None

    def continue_session(self, session_id: str) -> bool:
        """继续历史 Session"""
        loaded = self.load_session(session_id)
        if not loaded:
            return False

        # 如果有活跃 Session，先结束
        if self._current_session:
            self.end_session(success=False, summary={"reason": "switched_to_other_session"})

        # 复制并恢复
        self._current_session = loaded.copy()
        self._current_session["status"] = SessionStatus.ACTIVE.value
        self._current_session["continued_from"] = session_id
        self._current_session["continued_at"] = datetime.now().isoformat()

        logger.info(f"Session continued: {session_id}")
        return True

    def add_message(self, role: str, content: str, metadata: Dict = None) -> bool:
        """添加消息"""
        if not self._current_session:
            logger.warning("No active session")
            return False

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        self._current_session["messages"].append(message)
        self._current_session["updated_at"] = datetime.now().isoformat()
        return True

    def add_step(self, step: Dict) -> bool:
        """添加工作流步骤"""
        if not self._current_session:
            return False

        step["timestamp"] = datetime.now().isoformat()
        self._current_session["steps"].append(step)
        self._current_session["updated_at"] = datetime.now().isoformat()
        return True

    def get_current_session(self) -> Optional[Dict]:
        """获取当前 Session"""
        return self._current_session

    def get_session_messages(self, session_id: str = None) -> List[Dict]:
        """获取 Session 消息"""
        session = self.load_session(session_id) if session_id else self._current_session
        if not session:
            return []

        return session.get("messages", [])

    def get_session_steps(self, session_id: str = None) -> List[Dict]:
        """获取 Session 步骤"""
        session = self.load_session(session_id) if session_id else self._current_session
        if not session:
            return []

        return session.get("steps", [])

    def list_sessions(self, status: str = None, limit: int = 20) -> List[Dict]:
        """列出 Session"""
        sessions = self._session_history

        if status:
            sessions = [s for s in sessions if s["status"] == status]

        # 按时间倒序
        sessions = sorted(sessions, key=lambda x: x["created_at"], reverse=True)

        return sessions[:limit]

    def archive_session(self, session_id: str) -> bool:
        """归档 Session"""
        session = self.load_session(session_id)
        if not session:
            return False

        session["status"] = SessionStatus.ARCHIVED.value
        session["archived_at"] = datetime.now().isoformat()

        logger.info(f"Session archived: {session_id}")
        return True

    def clear_history(self):
        """清除历史"""
        self._session_history = []
        logger.info("Session history cleared")