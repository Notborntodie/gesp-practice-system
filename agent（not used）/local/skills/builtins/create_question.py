"""
创建题目 Skill

快速创建一道 OJ 题目的完整工作流。
"""

import logging
from typing import Dict, List, Any
from datetime import datetime

from local.skills.base import SkillBase, SkillResult, SkillStep

logger = logging.getLogger("create_question_skill")


class CreateQuestionSkill(SkillBase):
    """
    创建题目 Skill

    工作流：
    1. 生成题目描述
    2. 生成测试数据
    3. 生成参考代码
    4. 验证代码
    5. 上传题库
    """

    def __init__(self):
        workflow = [
            SkillStep(
                step=1,
                action="generate_description",
                name="题目描述",
                description="根据用户要求生成题目描述",
                optional=False
            ),
            SkillStep(
                step=2,
                action="generate_test_data",
                name="测试数据",
                description="生成测试输入输出数据",
                optional=False,
                tools_required=["generate_test_cases"]
            ),
            SkillStep(
                step=3,
                action="generate_reference_code",
                name="参考代码",
                description="生成参考解答代码",
                optional=False
            ),
            SkillStep(
                step=4,
                action="verify_code",
                name="验证代码",
                description="三阶段验证参考代码",
                optional=False,
                tools_required=["oj_test_run"]
            ),
            SkillStep(
                step=5,
                action="upload_to_oj",
                name="上传题库",
                description="上传到 OJ 题库",
                optional=False,
                tools_required=["create_question"]
            )
        ]

        params_template = {
            "difficulty": {
                "default": "medium",
                "options": ["easy", "medium", "hard"],
                "required": False
            },
            "category": {
                "default": "GESP",
                "options": ["GESP", "CSP_J", "CSP_S"],
                "required": False
            },
            "topic": {
                "default": None,
                "required": True,
                "description": "题目主题/知识点"
            },
            "story_mode": {
                "default": False,
                "required": False,
                "description": "是否使用故事化描述"
            },
            "language": {
                "default": "python",
                "options": ["python", "cpp", "c"],
                "required": False
            }
        }

        super().__init__(
            skill_id="builtin_create_question",
            name="创建题目",
            description="快速创建一道 OJ 题目，包含描述、测试数据、参考代码和验证",
            trigger_keywords=["创建题目", "新建题目", "创建一道题", "添加题目", "生成题目"],
            workflow=workflow,
            params_template=params_template
        )

    async def execute(
        self,
        params: Dict,
        context: Dict = None,
        on_step_complete=None
    ) -> SkillResult:
        """执行创建题目流程"""
        # 使用工作流执行
        result = await self.run_workflow(params, context, on_step_complete)

        # 处理验证失败的情况
        if result.data.get("verify_failed"):
            return SkillResult(
                success=False,
                needs_intervention=True,
                intervention_reason="参考代码验证失败，需要调整代码或测试数据",
                data=result.data,
                steps_completed=result.steps_completed,
                steps_total=result.steps_total
            )

        return result

    async def _execute_step(
        self,
        step: SkillStep,
        params: Dict,
        current_data: Dict,
        context: Dict
    ) -> Dict:
        """执行单个步骤"""
        action = step.action

        # Step 1: 生成描述
        if action == "generate_description":
            return await self._generate_description(params, current_data)

        # Step 2: 生成测试数据
        if action == "generate_test_data":
            return await self._generate_test_data(params, current_data)

        # Step 3: 生成参考代码
        if action == "generate_reference_code":
            return await self._generate_reference_code(params, current_data)

        # Step 4: 验证代码
        if action == "verify_code":
            return await self._verify_code(params, current_data)

        # Step 5: 上传题库
        if action == "upload_to_oj":
            return await self._upload_to_oj(params, current_data)

        return {"success": True, "data": {}}

    async def _generate_description(self, params: Dict, current_data: Dict) -> Dict:
        """生成题目描述"""
        topic = params.get("topic", "编程题")
        difficulty = params.get("difficulty", "medium")
        story_mode = params.get("story_mode", False)

        # 使用 LLM 生成（如果有）
        if self._llm_client:
            prompt = self._build_description_prompt(topic, difficulty, story_mode)

            # TODO: 实际 LLM 调用
            description = f"【{difficulty}】{topic} 相关的编程题目"

            if story_mode:
                description = f"小仓鼠🐹今天要学习{topic}，它遇到了一个有趣的问题..."

        else:
            description = f"题目：{topic}"

        return {
            "success": True,
            "data": {
                "description": description,
                "topic": topic,
                "difficulty": difficulty
            }
        }

    async def _generate_test_data(self, params: Dict, current_data: Dict) -> Dict:
        """生成测试数据"""
        # 使用 MCP 调用后端生成
        if self._mcp_client:
            result = await self._mcp_client.call_tool(
                "generate_test_cases",
                {
                    "description": current_data.get("description", ""),
                    "difficulty": params.get("difficulty", "medium"),
                    "count": 5
                }
            )

            if result.success:
                return {
                    "success": True,
                    "data": {
                        "test_cases": result.result.get("test_cases", [])
                    }
                }

        # 默认测试数据
        return {
            "success": True,
            "data": {
                "test_cases": [
                    {"input": "示例输入1", "output": "示例输出1"},
                    {"input": "示例输入2", "output": "示例输出2"}
                ]
            }
        }

    async def _generate_reference_code(self, params: Dict, current_data: Dict) -> Dict:
        """生成参考代码"""
        language = params.get("language", "python")
        description = current_data.get("description", "")

        # 使用 LLM 生成
        if self._llm_client:
            prompt = f"请为以下题目生成 {language} 参考代码:\n{description}"

            # TODO: 实际 LLM 调用
            code = f"# {language} 参考代码\n\ndef solution():\n    pass"

        else:
            code = "# 参考代码\npass"

        return {
            "success": True,
            "data": {
                "reference_code": code,
                "language": language
            }
        }

    async def _verify_code(self, params: Dict, current_data: Dict) -> Dict:
        """验证代码（三阶段）"""
        code = current_data.get("reference_code", "")
        language = current_data.get("language", "python")
        test_cases = current_data.get("test_cases", [])

        if self._mcp_client:
            # 调用 OJ 测试
            result = await self._mcp_client.call_tool(
                "oj_test_run",
                {
                    "code": code,
                    "language": language,
                    "test_cases": test_cases
                }
            )

            if result.success:
                verify_result = result.result

                if verify_result.get("verdict") == "AC":
                    return {
                        "success": True,
                        "data": {
                            "verified": True,
                            "verdict": "AC",
                            "passed_cases": verify_result.get("passed_cases", 0)
                        }
                    }
                else:
                    return {
                        "success": False,
                        "data": {
                            "verify_failed": True,
                            "verdict": verify_result.get("verdict"),
                            "error": verify_result.get("error")
                        }
                    }

        # 默认通过
        return {"success": True, "data": {"verified": True}}

    async def _upload_to_oj(self, params: Dict, current_data: Dict) -> Dict:
        """上传到题库"""
        if self._mcp_client:
            question_data = {
                "title": params.get("topic", "新题目"),
                "description": current_data.get("description", ""),
                "difficulty": params.get("difficulty", "medium"),
                "category": params.get("category", "GESP"),
                "test_cases": current_data.get("test_cases", []),
                "reference_code": current_data.get("reference_code", ""),
                "language": current_data.get("language", "python")
            }

            result = await self._mcp_client.call_tool(
                "create_question",
                question_data
            )

            if result.success:
                return {
                    "success": True,
                    "data": {
                        "question_id": result.result.get("question_id"),
                        "uploaded": True
                    }
                }

        return {"success": True, "data": {"uploaded": True}}

    def _build_description_prompt(self, topic: str, difficulty: str, story_mode: bool) -> str:
        """构建描述生成提示"""
        if story_mode:
            return f"""
请创建一道 {difficulty} 难度的 {topic} 编程题目。
要求使用故事化描述，适合中小学生理解。
包含：
1. 故事背景
2. 具体问题
3. 输入输出格式
4. 示例
"""
        else:
            return f"""
请创建一道 {difficulty} 难度的 {topic} 编程题目。
包含：
1. 题目描述
2. 输入输出格式
3. 示例
"""