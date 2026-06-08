import json
import os
import time
import requests
from typing import Dict, Any, Generator, AsyncGenerator


class LLMStreamProcessor:
    """
    题目提取处理器
    - 智谱AI glm-4.7-flash：使用 response_format=json_object 结构化输出
    - 阿里云 DashScope：兼容模式
    """

    def __init__(self, api_key: str = None, max_tokens: int = 16000, model: str = None):
        model = model or os.getenv("LLM_MODEL", "qwen-plus-latest")

        if model.startswith("glm-"):
            self.api_key = api_key or os.getenv("ZHIPU_API_KEY")
            self.api_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
            self.provider = "zhipu"
        else:
            self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
            self.api_url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
            self.provider = "dashscope"

        self.model = model
        self.max_tokens = max_tokens if max_tokens else 32000
        self._max_retries = 3
        self._base_delay = 5

    # ------------------------------------------------------------------ #
    #  Prompt
    # ------------------------------------------------------------------ #

    def _build_prompt(self, pdf_text: str, expected_count: int = None) -> tuple:
        """返回 (system_prompt, user_prompt)"""
        count_msg = f"PDF中共有{expected_count}道题，必须全部提取。" if expected_count else ""

        system = """你是题目提取专家。从PDF文本中提取所有题目，输出严格JSON格式。

输出格式：
{
  "questions": [
    {
      "question_text": "题目文本（不含题号）",
      "question_type": "text 或 code",
      "question_code": "代码内容（移除行号，添加正确缩进）或空字符串",
      "correct_answer": "正确答案标签，如 A/B/C/D，判断题为 A（正确）或 B（错误）",
      "explanation": "简要解析",
      "level": 3,
      "difficulty": "easy/medium/hard",
      "question_date": "2025-07",
      "options": [
        {"label": "A", "value": "A", "text": "选项原文"},
        {"label": "B", "value": "B", "text": "选项原文"},
        {"label": "C", "value": "C", "text": "选项原文"},
        {"label": "D", "value": "D", "text": "选项原文"}
      ]
    }
  ]
}

关键规则：
- 不要输出 category 字段，分类由上传者统一设置
- 所有文本字段（question_text、options 的 text、explanation）输出纯文本，不要使用 Markdown 格式（如 **加粗**、`代码`）或 LaTeX 格式（如 $公式$、$$公式$$）
- question_type: 题目包含代码用 code，否则用 text
- question_code: code 类型题目必须填写代码（移除行号、添加正确缩进），text 类型留空字符串 ""
- options 的 text 必须逐字复制 PDF 原文，禁止简写为"选项A"
- 判断题 options 固定为 [{"label":"A","value":"A","text":"正确"},{"label":"B","value":"B","text":"错误"}]，correct_answer 为 "A"（正确）或 "B"（错误）
- question_text 不含题号前缀
- level: 根据PDF内容推断等级（1-8），无法判断时填 1
- question_date: 根据PDF内容推断考试日期（YYYY-MM格式），无法判断时留空字符串 ""
- difficulty: 根据题目难度填 easy/medium/hard"""

        user = f"""请从以下PDF文本中提取所有题目。{count_msg}

PDF文本：
{pdf_text}"""

        return system, user

    # ------------------------------------------------------------------ #
    #  API 调用（非流式）
    # ------------------------------------------------------------------ #

    def _call_api(self, system_prompt: str, user_prompt: str) -> str:
        """非流式调用 API，返回完整响应文本"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0,
            "max_tokens": self.max_tokens,
        }

        # 智谱AI：结构化输出 + 关闭 thinking
        if self.provider == "zhipu":
            data["response_format"] = {"type": "json_object"}
            data["thinking"] = {"type": "disabled"}

        for attempt in range(self._max_retries):
            try:
                resp = requests.post(
                    self.api_url, headers=headers, json=data,
                    timeout=300,
                )
                if resp.status_code == 429:
                    wait = self._base_delay * (2 ** attempt)
                    print(f"⚠️ 429 速率限制，第{attempt+1}次重试，等待{wait}s...")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()

                result = resp.json()
                content = result["choices"][0]["message"]["content"]

                # 清理可能的 thinking 残留
                if "Thinking Process:" in content:
                    json_start = content.rfind("{")
                    if json_start > 0:
                        content = content[json_start:]

                return content

            except requests.exceptions.Timeout:
                print(f"⚠️ 请求超时(300s)，第{attempt+1}次重试...")
                continue

        raise Exception(f"调用API失败：重试{self._max_retries}次后仍失败")

    # ------------------------------------------------------------------ #
    #  主流程：非流式提取 → 逐题输出
    # ------------------------------------------------------------------ #

    def process_pdf_text_stream(self, pdf_text: str, expected_questions: int = None) -> Generator[Dict[str, Any], None, None]:
        """非流式API调用，解析后逐题yield给前端"""
        try:
            yield {"type": "process_start", "message": "开始提取PDF题目"}

            if not pdf_text or not pdf_text.strip():
                yield {"type": "error", "error": "PDF文本为空", "message": "❌ PDF文本提取为空，可能是扫描版PDF"}
                return

            yield {
                "type": "chunk_info",
                "message": f"PDF文本 {len(pdf_text)} 字符，AI提取中",
                "chunk_count": 1,
            }
            yield {
                "type": "chunk_start",
                "message": "调用AI提取题目",
                "chunk_index": 0,
                "chunk_size": len(pdf_text),
            }

            print(f"\n🤖 模型: {self.model}, 文本: {len(pdf_text)} 字符")
            print(f"📄 PDF前200字: {pdf_text[:200]}...\n")

            system_prompt, user_prompt = self._build_prompt(pdf_text, expected_questions)
            content = self._call_api(system_prompt, user_prompt)

            parsed = json.loads(content)
            all_questions = parsed.get("questions", [])
            total = 0

            print(f"📊 解析到 {len(all_questions)} 道题目")

            for q in all_questions:
                if self._is_valid(q):
                    total += 1
                    print(f"  📝 第 {total} 题: {q.get('question_text', '')[:40]}...")
                    yield {
                        "type": "question",
                        "question": q,
                        "question_index": total - 1,
                        "chunk_index": 0,
                        "message": f"✅ 第 {total} 个题目提取完成",
                    }
                    if expected_questions and total >= expected_questions:
                        break

            print(f"✅ 共提取 {total} 道题目\n")

            yield {
                "type": "chunk_complete",
                "message": f"提取完成，共 {total} 题",
                "chunk_index": 0,
                "chunk_questions": total,
            }

            if expected_questions and total < expected_questions:
                yield {
                    "type": "warning",
                    "message": f"⚠️ 预期 {expected_questions} 题，实际 {total} 题",
                    "expected": expected_questions,
                    "actual": total,
                    "missing": expected_questions - total,
                }

            yield {
                "type": "process_complete",
                "message": f"🎉 处理完成！共提取 {total} 题",
                "total_questions": total,
                "chunk_count": 1,
                "expected_questions": expected_questions,
            }

        except Exception as e:
            print(f"❌ 处理失败: {str(e)}")
            yield {"type": "error", "error": str(e), "message": f"❌ 处理失败: {str(e)}"}

    def _is_valid(self, q: dict) -> bool:
        """检查题目是否有效"""
        return bool(q.get("question_text") and q.get("correct_answer") is not None)

    # ------------------------------------------------------------------ #
    #  异步版本（保留兼容）
    # ------------------------------------------------------------------ #

    async def process_pdf_text_stream_async(self, pdf_text: str, expected_questions: int = None) -> AsyncGenerator[Dict[str, Any], None]:
        """异步版 - 内部用同步调用（简化实现）"""
        for item in self.process_pdf_text_stream(pdf_text, expected_questions):
            yield item
