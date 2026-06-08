"""
多 Provider LLM Client

支持智谱、DeepSeek、Claude、OpenAI 等多个 Provider。
"""

import logging
import asyncio
import httpx
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger("llm_client")


class ProviderType(Enum):
    """LLM Provider 类型"""
    ZHIPU = "zhipu"
    DEEPSEEK = "deepseek"
    CLAUDE = "claude"
    OPENAI = "openai"


@dataclass
class LLMConfig:
    """LLM 配置"""
    provider: str
    api_key: str
    model: str
    base_url: str = ""
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout: int = 60


class ProviderFormatType(Enum):
    """Provider API 格式"""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class LLMClient:
    """
    多 Provider LLM Client

    根据不同 Provider 使用不同的 API 格式：
    - 智谱/Claude: Anthropic 格式
    - DeepSeek/OpenAI: OpenAI 格式
    """

    # Provider 格式映射
    FORMAT_TYPES = {
        ProviderType.ZHIPU: ProviderFormatType.ANTHROPIC,
        ProviderType.CLAUDE: ProviderFormatType.ANTHROPIC,
        ProviderType.DEEPSEEK: ProviderFormatType.OPENAI,
        ProviderType.OPENAI: ProviderFormatType.OPENAI
    }

    # Provider 默认 URL
    BASE_URLS = {
        ProviderType.ZHIPU: "https://open.bigmodel.cn/api/paas/v4",
        ProviderType.CLAUDE: "https://api.anthropic.com",
        ProviderType.DEEPSEEK: "https://api.deepseek.com",
        ProviderType.OPENAI: "https://api.openai.com"
    }

    def __init__(self, config: LLMConfig):
        self.config = config

        # 确定 Provider 类型
        self.provider = self._get_provider_type(config.provider)
        self.format_type = self.FORMAT_TYPES.get(self.provider, ProviderFormatType.ANTHROPIC)

        # 设置 Base URL
        self.base_url = config.base_url or self.BASE_URLS.get(self.provider, "")

        # 重试配置
        self.retry_count: int = 0
        self.max_retries: int = 3
        self.retry_delay: float = 1.0

        # Token 计数器
        self._total_tokens: int = 0
        self._request_count: int = 0

        # HTTP Client
        self._client: Optional[httpx.AsyncClient] = None

    def _get_provider_type(self, provider: str) -> ProviderType:
        """获取 Provider 类型"""
        try:
            return ProviderType(provider.lower())
        except ValueError:
            logger.warning(f"Unknown provider: {provider}, defaulting to ZHIPU")
            return ProviderType.ZHIPU

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP Client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self._client

    async def close(self):
        """关闭 HTTP Client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def stream(
        self,
        messages: List[Dict],
        tools: List[Dict] = None,
        system_prompt: str = None
    ) -> AsyncGenerator[Any, None]:
        """
        流式响应

        Args:
            messages: 消息列表
            tools: 工具列表（可选）
            system_prompt: 系统提示（可选）

        Yields:
            ToolResponse 对象
        """
        request = self.build_request(messages, tools, system_prompt)

        client = await self._get_client()
        headers = self._build_headers()

        # 工具输入累积
        current_tool_name: str = ""
        current_tool_input: str = ""

        try:
            response = await client.post(
                self._build_endpoint(),
                json=request,
                headers=headers,
                timeout=self.config.timeout
            )

            if response.status_code != 200:
                error_msg = f"API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                yield ToolResponse(type="error", error=error_msg, success=False)
                return

            # 流式解析响应
            for line in response.iter_lines():
                if not line:
                    continue

                # 解码 bytes 到 str
                if isinstance(line, bytes):
                    line = line.decode('utf-8')

                chunk = self._parse_stream_chunk(line)
                if chunk:
                    # 处理工具输入增量
                    if chunk.type == "tool_input_delta":
                        current_tool_input += chunk.content
                        continue

                    # 处理内容块结束
                    if chunk.type == "content_block_stop":
                        if current_tool_name and current_tool_input:
                            # 解析完整的工具输入 JSON
                            try:
                                import json
                                tool_input = json.loads(current_tool_input)
                            except json.JSONDecodeError:
                                tool_input = {"raw": current_tool_input}

                            yield ToolResponse(
                                type="tool_use",
                                name=current_tool_name,
                                input=tool_input
                            )
                            current_tool_name = ""
                            current_tool_input = ""
                        continue

                    # 处理工具调用开始
                    if chunk.type == "tool_use":
                        current_tool_name = chunk.name
                        current_tool_input = ""
                        # 不立即 yield，等待输入累积完成
                        continue

                    # 文本内容直接 yield
                    if chunk.type == "text" and chunk.content:
                        yield chunk

        except httpx.TimeoutException:
            logger.error("API timeout")
            yield ToolResponse(type="error", error="请求超时", success=False)
        except Exception as e:
            logger.error(f"API error: {e}")
            yield ToolResponse(type="error", error=str(e), success=False)

    async def chat(
        self,
        messages: List[Dict],
        tools: List[Dict] = None,
        system_prompt: str = None
    ) -> Any:
        """
        非流式响应

        Returns:
            ToolResponse 对象
        """
        chunks = []
        async for chunk in self.stream(messages, tools, system_prompt):
            chunks.append(chunk)

        # 合并响应
        text_content = "".join([c.content for c in chunks if c.content])

        # 查找最后一个 tool_use
        tool_uses = [c for c in chunks if c.type == "tool_use"]

        if tool_uses:
            return tool_uses[-1]

        return ToolResponse(type="text", content=text_content)

    async def call_with_retry(
        self,
        messages: List[Dict],
        max_retries: int = 3
    ) -> Any:
        """
        带重试的调用

        Args:
            messages: 消息列表
            max_retries: 最大重试次数

        Returns:
            响应或抛出异常
        """
        for attempt in range(max_retries):
            try:
                self.retry_count = attempt
                return await self.chat(messages)

            except Exception as e:
                logger.warning(f"Retry {attempt + 1}/{max_retries}: {e}")

                if attempt == max_retries - 1:
                    raise

                await asyncio.sleep(self.retry_delay * (attempt + 1))

        raise Exception("重试次数已用尽")

    def build_request(
        self,
        messages: List[Dict],
        tools: List[Dict] = None,
        system_prompt: str = None
    ) -> Dict:
        """
        构建 API 请求

        根据 Provider 格式类型构建不同的请求结构
        """
        if self.format_type == ProviderFormatType.ANTHROPIC:
            return self._build_anthropic_request(messages, tools, system_prompt)
        else:
            return self._build_openai_request(messages, tools, system_prompt)

    def _build_anthropic_request(
        self,
        messages: List[Dict],
        tools: List[Dict] = None,
        system_prompt: str = None
    ) -> Dict:
        """构建 Anthropic 格式请求"""
        request = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": self.config.max_tokens,
            "stream": True,
            "anthropic_version": "2024-01-01"
        }

        if system_prompt:
            request["system"] = system_prompt

        if tools:
            request["tools"] = self._convert_tools_anthropic(tools)

        return request

    def _build_openai_request(
        self,
        messages: List[Dict],
        tools: List[Dict] = None,
        system_prompt: str = None
    ) -> Dict:
        """构建 OpenAI 格式请求"""
        # OpenAI 格式系统消息放在 messages 中
        all_messages = messages.copy()

        if system_prompt:
            all_messages.insert(0, {"role": "system", "content": system_prompt})

        request = {
            "model": self.config.model,
            "messages": all_messages,
            "max_tokens": self.config.max_tokens,
            "stream": True,
            "temperature": self.config.temperature
        }

        if tools:
            request["tools"] = self._convert_tools_openai(tools)

        return request

    def _convert_tools_anthropic(self, tools: List[Dict]) -> List[Dict]:
        """转换工具为 Anthropic 格式"""
        converted = []
        for tool in tools:
            converted.append({
                "name": tool.get("name", ""),
                "description": tool.get("description", ""),
                "input_schema": tool.get("parameters", {"type": "object"})
            })
        return converted

    def _convert_tools_openai(self, tools: List[Dict]) -> List[Dict]:
        """转换工具为 OpenAI 格式"""
        converted = []
        for tool in tools:
            converted.append({
                "type": "function",
                "function": {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("parameters", {"type": "object"})
                }
            })
        return converted

    def _build_headers(self) -> Dict:
        """构建请求头"""
        if self.format_type == ProviderFormatType.ANTHROPIC:
            return {
                "x-api-key": self.config.api_key,
                "anthropic-version": "2024-01-01",
                "content-type": "application/json"
            }
        else:
            return {
                "Authorization": f"Bearer {self.config.api_key}",
                "content-type": "application/json"
            }

    def _build_endpoint(self) -> str:
        """构建 API Endpoint"""
        if self.format_type == ProviderFormatType.ANTHROPIC:
            return f"{self.base_url}/v1/messages"
        else:
            return f"{self.base_url}/v1/chat/completions"

    def _parse_stream_chunk(self, line: str) -> Any:
        """解析流式响应块"""
        import json

        # 解码 bytes 到 str
        if isinstance(line, bytes):
            line = line.decode('utf-8')

        # 去除行尾换行符
        line = line.rstrip('\n\r')

        # 空行直接跳过
        if not line or line.strip() == "":
            return None

        # SSE 格式: event:xxx 和 data:yyy 是分开的行
        # event 行只提供元数据，跳过
        if line.startswith("event:"):
            logger.debug(f"SSE event: {line}")
            return None

        # 去除 SSE data 前缀
        if line.startswith("data:"):
            line = line[5:]  # "data:" 长度为5
            if line.startswith(" "):
                line = line[1:]  # 去除可能的前导空格

        # 空内容或结束标记
        if not line or line.strip() == "" or line == "[DONE]":
            return None

        try:
            data = json.loads(line)

            if self.format_type == ProviderFormatType.ANTHROPIC:
                return self._parse_anthropic_chunk(data)
            else:
                return self._parse_openai_chunk(data)

        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON chunk: {line[:100]}, error: {e}")
            return None

    def _parse_anthropic_chunk(self, data: Dict) -> Any:
        """解析 Anthropic 格式响应

        Anthropic SSE event types:
        - message_start: 消息开始，包含 metadata
        - content_block_start: 内容块开始（text/thinking/tool_use）
        - content_block_delta: 内容增量（text_delta/thinking_delta/input_json_delta）
        - content_block_stop: 内容块结束
        - message_delta: 消息增量（如 stop_reason）
        - message_stop: 消息结束
        - ping: 心跳
        """
        event_type = data.get("type", "")

        # 消息级别事件
        if event_type == "message_start":
            # 包含 model、usage 等信息，暂不处理
            msg = data.get("message", {})
            logger.debug(f"Message start: model={msg.get('model', 'unknown')}")
            return None

        if event_type == "message_delta":
            # 包含 stop_reason、usage 等
            delta = data.get("delta", {})
            stop_reason = delta.get("stop_reason")
            if stop_reason:
                logger.debug(f"Message stop reason: {stop_reason}")
            return None

        if event_type == "message_stop":
            logger.debug("Message complete")
            return None

        # ping 事件（心跳）
        if event_type == "ping":
            return None

        # 内容块事件
        if event_type == "content_block_start":
            block = data.get("content_block", {})
            block_type = block.get("type", "")

            if block_type == "text":
                # 文本块开始
                return None
            elif block_type == "thinking":
                # 思考/推理块开始（DashScope 特有）
                return ToolResponse(type="thinking_start")
            elif block_type == "tool_use":
                # 工具调用开始
                return ToolResponse(
                    type="tool_use",
                    name=block.get("name", ""),
                    input={}
                )

        if event_type == "content_block_delta":
            delta = data.get("delta", {})
            delta_type = delta.get("type", "")

            if delta_type == "text_delta":
                # 文本增量
                text = delta.get("text", "")
                if text:
                    return ToolResponse(type="text", content=text)

            elif delta_type == "thinking_delta":
                # 思考内容增量（DashScope 特有）
                thinking = delta.get("thinking", "")
                if thinking:
                    return ToolResponse(type="thinking", content=thinking)

            elif delta_type == "input_json_delta":
                # 工具参数增量（JSON 片段）
                partial_json = delta.get("partial_json", "")
                # 累积参数需要在外部处理，这里返回增量
                return ToolResponse(
                    type="tool_input_delta",
                    content=partial_json
                )

        if event_type == "content_block_stop":
            # 内容块完成
            return ToolResponse(type="content_block_stop")

        return None

    def _parse_openai_chunk(self, data: Dict) -> Any:
        """解析 OpenAI 格式响应"""
        choices = data.get("choices", [])
        if not choices:
            return None

        choice = choices[0]
        delta = choice.get("delta", {})

        # 文本内容
        content = delta.get("content", "")
        if content:
            return ToolResponse(type="text", content=content)

        # 工具调用
        tool_calls = delta.get("tool_calls", [])
        if tool_calls:
            tool_call = tool_calls[0]
            return ToolResponse(
                type="tool_use",
                name=tool_call.get("function", {}).get("name", ""),
                input=json.loads(tool_call.get("function", {}).get("arguments", "{}"))
            )

        return None

    def count_tokens(self, text: str) -> int:
        """
        Token 计数

        中文约 2 字符/token，英文约 4 字符/token
        """
        if not text:
            return 1

        # 计算中文字符数
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')

        # 计算其他字符数
        other_chars = len(text) - chinese_chars

        # 估算 token 数
        tokens = chinese_chars // 2 + other_chars // 4

        return max(1, tokens)

    def estimate_cost(self, tokens: int) -> float:
        """
        估算成本

        返回预估费用（单位：元）
        """
        # 不同 Provider 价格（输入/输出每千 token）
        PRICES = {
            ProviderType.ZHIPU: 0.001,      # 智谱约 0.001 元/千 token
            ProviderType.DEEPSEEK: 0.0005,  # DeepSeek 约 0.0005 元/千 token
            ProviderType.CLAUDE: 0.003,     # Claude 约 0.003 元/千 token
            ProviderType.OPENAI: 0.002,     # OpenAI 约 0.002 元/千 token
        }

        price_per_k = PRICES.get(self.provider, 0.001)
        return tokens * price_per_k / 1000

    def get_stats(self) -> Dict:
        """获取使用统计"""
        return {
            "provider": self.provider.value,
            "model": self.config.model,
            "total_tokens": self._total_tokens,
            "request_count": self._request_count,
            "estimated_cost": self.estimate_cost(self._total_tokens)
        }

    async def test_connection(self) -> Dict:
        """测试连接"""
        test_messages = [{"role": "user", "content": "你好"}]

        try:
            response = await self.chat(test_messages)
            return {
                "success": True,
                "provider": self.provider.value,
                "model": self.config.model,
                "message": "连接成功"
            }
        except Exception as e:
            return {
                "success": False,
                "provider": self.provider.value,
                "error": str(e)
            }


@dataclass
class ToolResponse:
    """工具响应"""
    type: str  # "text", "tool_use", "tool_result", "error"
    content: str = ""
    name: str = ""
    input: Dict = field(default_factory=dict)
    result: Dict = field(default_factory=dict)
    success: bool = True
    error: str = ""