"""
HTTPS Transport - 安全传输层

实现请求签名和安全传输。
"""

import logging
import hashlib
import hmac
import time
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger("https_transport")


class HTTPSTransport:
    """
    HTTPS 安全传输

    功能：
    - 请求签名
    - 时间戳验证
    - 请求重试
    """

    def __init__(
        self,
        api_key: str,
        secret_key: str = None,
        request_timeout: int = 30,
        max_retries: int = 3
    ):
        self.api_key = api_key
        self.secret_key = secret_key
        self.request_timeout = request_timeout
        self.max_retries = max_retries

    def sign_request(self, payload: Dict, timestamp: int = None) -> Dict:
        """
        签名请求

        Args:
            payload: 请求内容
            timestamp: 时间戳（可选）

        Returns:
            签名后的请求头
        """
        if timestamp is None:
            timestamp = int(time.time())

        # 构建签名内容
        sign_content = self._build_sign_content(payload, timestamp)

        # 计算签名
        signature = self._compute_signature(sign_content)

        headers = {
            "X-API-Key": self.api_key,
            "X-Timestamp": str(timestamp),
            "X-Signature": signature
        }

        return headers

    def _build_sign_content(self, payload: Dict, timestamp: int) -> str:
        """构建签名内容"""
        # 将 payload 序列化
        import json
        payload_str = json.dumps(payload, sort_keys=True)

        # 组合签名内容
        sign_content = f"{self.api_key}{timestamp}{payload_str}"

        return sign_content

    def _compute_signature(self, content: str) -> str:
        """计算签名"""
        if self.secret_key:
            # HMAC-SHA256 签名
            signature = hmac.new(
                self.secret_key.encode(),
                content.encode(),
                hashlib.sha256
            ).hexdigest()
        else:
            # SHA256 哈希（无密钥）
            signature = hashlib.sha256(content.encode()).hexdigest()

        return signature

    def verify_timestamp(self, timestamp: int, max_age_seconds: int = 300) -> bool:
        """
        验证时间戳

        Args:
            timestamp: 时间戳
            max_age_seconds: 最大允许时间差（秒）

        Returns:
            是否有效
        """
        current_time = int(time.time())
        time_diff = abs(current_time - timestamp)

        return time_diff <= max_age_seconds

    def verify_signature(
        self,
        payload: Dict,
        timestamp: int,
        signature: str
    ) -> bool:
        """
        验证签名

        Args:
            payload: 请求内容
            timestamp: 时间戳
            signature: 签名

        Returns:
            是否有效
        """
        # 验证时间戳
        if not self.verify_timestamp(timestamp):
            logger.warning("Timestamp verification failed")
            return False

        # 计算签名
        sign_content = self._build_sign_content(payload, timestamp)
        expected_signature = self._compute_signature(sign_content)

        # 比较
        return hmac.compare_digest(signature, expected_signature)

    def build_retry_strategy(self) -> Dict:
        """构建重试策略"""
        return {
            "max_retries": self.max_retries,
            "retry_delay": 1.0,  # 1秒
            "retry_multiplier": 2.0,  # 递增倍数
            "retry_on_status": [500, 502, 503, 504]
        }

    def should_retry(self, status_code: int, attempt: int) -> bool:
        """
        判断是否应该重试

        Args:
            status_code: HTTP 状态码
            attempt: 当前尝试次数

        Returns:
            是否应该重试
        """
        if attempt >= self.max_retries:
            return False

        retry_status = [500, 502, 503, 504, 429]
        return status_code in retry_status

    def get_retry_delay(self, attempt: int) -> float:
        """
        获取重试延迟

        Args:
            attempt: 当前尝试次数

        Returns:
            延迟秒数
        """
        base_delay = 1.0
        multiplier = 2.0

        return base_delay * (multiplier ** attempt)