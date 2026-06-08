"""
Agent 状态枚举与状态管理
"""

import logging
from enum import Enum
from typing import Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger("agent_state")


class AgentState(Enum):
    """Agent 状态枚举"""
    IDLE = "idle"
    PROCESSING = "processing"
    WAITING_APPROVAL = "waiting_approval"
    WAITING_INTERVENTION = "waiting_intervention"
    WAITING_CONFIRM = "waiting_confirm"
    COMPLETED = "completed"
    ERROR = "error"
    SHUTDOWN = "shutdown"


class StateManager:
    """状态管理器"""

    # 状态转换规则
    VALID_TRANSITIONS = {
        AgentState.IDLE: [AgentState.PROCESSING, AgentState.SHUTDOWN],
        AgentState.PROCESSING: [
            AgentState.IDLE,
            AgentState.WAITING_APPROVAL,
            AgentState.WAITING_INTERVENTION,
            AgentState.WAITING_CONFIRM,
            AgentState.COMPLETED,
            AgentState.ERROR
        ],
        AgentState.WAITING_APPROVAL: [AgentState.PROCESSING, AgentState.IDLE, AgentState.ERROR],
        AgentState.WAITING_INTERVENTION: [AgentState.PROCESSING, AgentState.IDLE, AgentState.ERROR],
        AgentState.WAITING_CONFIRM: [AgentState.PROCESSING, AgentState.COMPLETED, AgentState.ERROR],
        AgentState.COMPLETED: [AgentState.IDLE],
        AgentState.ERROR: [AgentState.IDLE, AgentState.PROCESSING],
        AgentState.SHUTDOWN: []
    }

    def __init__(self):
        self._state: AgentState = AgentState.IDLE
        self._state_history: list = []
        self._state_data: Dict[str, Any] = {}
        self._error_count: int = 0
        self._max_errors: int = 5

    def get_state(self) -> AgentState:
        """获取当前状态"""
        return self._state

    def set_state(self, new_state: AgentState, data: Dict = None) -> bool:
        """设置状态（带转换检查）"""
        if new_state not in self.VALID_TRANSITIONS.get(self._state, []):
            logger.warning(f"Invalid state transition: {self._state} -> {new_state}")
            # 允许强制转换以处理异常情况
            if new_state == AgentState.ERROR or new_state == AgentState.IDLE:
                self._force_set_state(new_state, data)
                return True
            return False

        self._state = new_state
        self._state_history.append({
            "state": new_state.value,
            "timestamp": datetime.now().isoformat(),
            "data": data
        })

        if data:
            self._state_data.update(data)

        logger.info(f"State changed: {self._state.value}")

        # 错误计数
        if new_state == AgentState.ERROR:
            self._error_count += 1
            if self._error_count >= self._max_errors:
                logger.error(f"Error count exceeded: {self._error_count}")
                self._force_set_state(AgentState.SHUTDOWN, {"reason": "max_errors"})

        return True

    def _force_set_state(self, new_state: AgentState, data: Dict = None):
        """强制设置状态"""
        self._state = new_state
        self._state_history.append({
            "state": new_state.value,
            "timestamp": datetime.now().isoformat(),
            "forced": True,
            "data": data
        })
        if data:
            self._state_data.update(data)
        logger.warning(f"Force state change to: {new_state.value}")

    def get_state_data(self) -> Dict[str, Any]:
        """获取状态附加数据"""
        return self._state_data

    def clear_state_data(self):
        """清除状态附加数据"""
        self._state_data = {}

    def get_history(self, limit: int = 10) -> list:
        """获取状态历史"""
        return self._state_history[-limit:]

    def reset_error_count(self):
        """重置错误计数"""
        self._error_count = 0

    def is_idle(self) -> bool:
        """是否空闲"""
        return self._state == AgentState.IDLE

    def is_processing(self) -> bool:
        """是否正在处理"""
        return self._state == AgentState.PROCESSING

    def is_waiting(self) -> bool:
        """是否等待中"""
        return self._state in [
            AgentState.WAITING_APPROVAL,
            AgentState.WAITING_INTERVENTION,
            AgentState.WAITING_CONFIRM
        ]

    def is_error(self) -> bool:
        """是否错误"""
        return self._state == AgentState.ERROR

    def is_shutdown(self) -> bool:
        """是否关闭"""
        return self._state == AgentState.SHUTDOWN