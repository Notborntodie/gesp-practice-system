"""
流式响应处理器

处理 LLM 流式响应，支持中断恢复。
"""

import logging
import json
from typing import Dict, List, Any, AsyncGenerator
from dataclasses import dataclass

logger = logging.getLogger("stream_processor")


@dataclass
class StreamChunk:
    """流式响应块"""
    type: str  # "text", "tool_use", "tool_result", "error"
    content: str = ""
    name: str = ""
    input: Dict = None
    result: Dict = None
    is_complete: bool = False


class StreamProcessor:
    """
    流式响应处理器

    功能：
    - 聚合流式文本块
    - 处理工具调用
    - 支持暂停恢复
    """

    def __init__(self):
        self._chunks: List[StreamChunk] = []
        self._current_tool_input: str = ""
        self._current_tool_name: str = ""
        self._is_paused: bool = False
        self._buffer: str = ""

    async def process_stream(
        self,
        stream: AsyncGenerator[Any, None]
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        处理流式响应

        Args:
            stream: LLM 流式响应

        Yields:
            StreamChunk 对象
        """
        for chunk in stream:
            if self._is_paused:
                # 暂停时缓冲
                self._buffer += str(chunk)
                continue

            processed = self._process_chunk(chunk)
            if processed:
                self._chunks.append(processed)
                yield processed

        # 处理缓冲（恢复后）
        if self._buffer and not self._is_paused:
            # TODO: 重新解析缓冲内容
            pass

    def _process_chunk(self, raw_chunk: Any) -> StreamChunk:
        """处理单个块"""
        if hasattr(raw_chunk, "type"):
            # 已是 StreamChunk 或 ToolResponse
            return self._convert_to_stream_chunk(raw_chunk)

        # 尝试解析 JSON
        try:
            if isinstance(raw_chunk, str):
                data = json.loads(raw_chunk)
                return self._parse_json_chunk(data)
        except json.JSONDecodeError:
            # 文本块
            return StreamChunk(type="text", content=str(raw_chunk))

        return None

    def _convert_to_stream_chunk(self, chunk: Any) -> StreamChunk:
        """转换为 StreamChunk"""
        return StreamChunk(
            type=chunk.type,
            content=chunk.content if hasattr(chunk, "content") else "",
            name=chunk.name if hasattr(chunk, "name") else "",
            input=chunk.input if hasattr(chunk, "input") else None,
            result=chunk.result if hasattr(chunk, "result") else None,
            is_complete=True
        )

    def _parse_json_chunk(self, data: Dict) -> StreamChunk:
        """解析 JSON 格式块"""
        # Anthropic 格式
        if "type" in data:
            event_type = data["type"]

            if event_type == "content_block_delta":
                delta = data.get("delta", {})
                return StreamChunk(
                    type="text",
                    content=delta.get("text", "")
                )

            elif event_type == "content_block_start":
                block = data.get("content_block", {})
                if block.get("type") == "tool_use":
                    return StreamChunk(
                        type="tool_use",
                        name=block.get("name", ""),
                        input={},
                        is_complete=False
                    )

        # OpenAI 格式
        if "choices" in data:
            choices = data["choices"]
            if choices:
                delta = choices[0].get("delta", {})

                content = delta.get("content", "")
                if content:
                    return StreamChunk(type="text", content=content)

                tool_calls = delta.get("tool_calls", [])
                if tool_calls:
                    tool = tool_calls[0]
                    return StreamChunk(
                        type="tool_use",
                        name=tool.get("function", {}).get("name", ""),
                        input=json.loads(tool.get("function", {}).get("arguments", "{}")),
                        is_complete=bool(tool.get("function", {}).get("arguments"))
                    )

        return None

    def pause(self):
        """暂停处理"""
        self._is_paused = True
        logger.info("Stream processing paused")

    def resume(self):
        """恢复处理"""
        self._is_paused = False
        logger.info("Stream processing resumed")

    def get_aggregated_text(self) -> str:
        """获取聚合文本"""
        return "".join([
            c.content for c in self._chunks
            if c.type == "text" and c.content
        ])

    def get_tool_calls(self) -> List[Dict]:
        """获取工具调用列表"""
        return [
            {
                "name": c.name,
                "input": c.input
            }
            for c in self._chunks
            if c.type == "tool_use" and c.name
        ]

    def get_last_tool_call(self) -> Dict:
        """获取最后一个工具调用"""
        tool_calls = self.get_tool_calls()
        return tool_calls[-1] if tool_calls else None

    def clear(self):
        """清除状态"""
        self._chunks = []
        self._current_tool_input = ""
        self._current_tool_name = ""
        self._buffer = ""

    def get_stats(self) -> Dict:
        """获取统计"""
        return {
            "chunk_count": len(self._chunks),
            "text_length": len(self.get_aggregated_text()),
            "tool_call_count": len(self.get_tool_calls()),
            "is_paused": self._is_paused
        }