import json
import os
import requests
from typing import Dict, Any, List

class ExplanationProcessor:
    """
    答案解析处理器，专门用于快速生成题目的详细解析
    """
    
    def __init__(self, api_key: str = None, max_tokens: int = 400, model: str = None):
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        self.api_url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
        self.model = model or os.getenv("LLM_MODEL", "qwen-plus-latest")
        self.max_tokens = max_tokens  # 保证50-200字质量
    
    def create_explanation_prompt(self, question_data: Dict[str, Any]) -> str:
        """创建答案解析的prompt（优化版本，快速响应）"""
        
        # 构建题目信息
        question_text = question_data.get("question_text", "")
        question_type = question_data.get("question_type", "text")
        question_code = question_data.get("question_code", "")
        correct_answer = question_data.get("correct_answer", "")
        options = question_data.get("options", [])
        
        # 构建选项文本（简化）
        options_text = " ".join([f"{opt.get('label', '')}.{opt.get('text', '')}" for opt in options])
        
        # 构建完整的题目内容
        if question_type == "code" and question_code:
            full_question = f"{question_text}\n代码：\n{question_code}"
        else:
            full_question = question_text
        
        return f"""题目：{full_question}
选项：{options_text}
答案：{correct_answer}

请生成50-200字的解析，只解释为什么{correct_answer}是正确答案，不需要包含知识点。

解析："""

    def call_api(self, prompt: str) -> str:
        """调用DashScope API"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            data = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "你是编程教育专家，解释答案什么正确，和其他选项为啥错误"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5,  # 稍微提高创造性，保证质量
                "max_tokens": self.max_tokens,
                "stream": False,
                "top_p": 0.8
            }
            
            response = requests.post(self.api_url, headers=headers, json=data, timeout=5)
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except Exception as e:
            raise Exception(f"调用DashScope API失败: {str(e)}")
    
    def generate_explanation(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        为单个题目生成答案解析（极速版本）
        
        Args:
            question_data: 题目数据，包含题目信息
            
        Returns:
            Dict: 包含原始题目和详细解析的结果
        """
        try:
            print(f"🔍 开始生成题目解析...")
            
            # 验证题目数据
            if not question_data.get("question_text"):
                raise ValueError("题目数据缺少question_text字段")
            
            # 直接使用API解析
            prompt = self.create_explanation_prompt(question_data)
            explanation = self.call_api(prompt)
            
            # 构建返回结果
            result = {
                "original_question": question_data,
                "explanation": explanation,
                "status": "success",
                "generated_at": self._get_current_time()
            }
            
            print(f"✅ 题目解析生成完成")
            return result
            
        except Exception as e:
            print(f"❌ 生成题目解析失败: {str(e)}")
            return {
                "original_question": question_data,
                "explanation": "",
                "status": "error",
                "error": str(e),
                "generated_at": self._get_current_time()
            }
    
    
    def generate_batch_explanations(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        批量生成多个题目的答案解析
        
        Args:
            questions: 题目列表
            
        Returns:
            List[Dict]: 包含解析结果的列表
        """
        results = []
        
        print(f"📚 开始批量生成 {len(questions)} 个题目的解析...")
        
        for i, question in enumerate(questions):
            print(f"🔄 处理第 {i+1}/{len(questions)} 个题目...")
            result = self.generate_explanation(question)
            results.append(result)
        
        print(f"🎉 批量解析完成！成功处理 {len(results)} 个题目")
        return results
    
    def _get_current_time(self) -> str:
        """获取当前时间字符串"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def validate_question_data(self, question_data: Dict[str, Any]) -> bool:
        """
        验证题目数据的完整性
        
        Args:
            question_data: 题目数据
            
        Returns:
            bool: 数据是否有效
        """
        required_fields = ["question_text", "question_type", "correct_answer", "options"]
        
        for field in required_fields:
            if field not in question_data:
                print(f"⚠️ 缺少必需字段: {field}")
                return False
        
        # 验证选项格式
        options = question_data.get("options", [])
        if not isinstance(options, list) or len(options) == 0:
            print(f"⚠️ 选项数据格式错误")
            return False
        
        # 验证每个选项的格式
        for option in options:
            if not isinstance(option, dict):
                print(f"⚠️ 选项格式错误，应为字典类型")
                return False
            if "label" not in option or "text" not in option:
                print(f"⚠️ 选项缺少label或text字段")
                return False
        
        return True
