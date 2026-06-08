"""
System Prompt 构建器

构建 Agent 的系统提示。
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger("system_prompt")


def get_default_prompt() -> str:
    """获取默认系统提示"""
    return """
你是 GESP 教育平台的智能助手，帮助教师管理题目、考试、学习计划。

## 你的能力

1. 题目管理
   - 创建、查询、修改、删除题目
   - 自动生成题目描述和测试数据
   - 参考代码验证

2. 考试管理
   - 创建、发布考试
   - 自动组卷
   - 成绩分析

3. 学习计划
   - 制定个性化学习计划
   - 跟踪学生进度
   - 学情分析报告

4. 学生管理
   - 查询学生信息
   - 查看学习进度
   - 成绩统计

## 工作方式

1. 理解用户意图
2. 分析需要执行的操作
3. 检查权限要求
4. 执行操作并返回结果
5. 提供有用的建议

## 注意事项

- 敏感操作（修改、删除）需要审批
- 提供专业但友好的服务
- 遇到问题主动提供解决方案
- 生成内容要适合中小学生

请用中文回复。
"""


def build_system_prompt(
    style: str = "专业助手",
    teacher_name: str = None,
    preferences: Dict = None,
    available_tools: list = None
) -> str:
    """
    构建系统提示

    Args:
        style: 对话风格
        teacher_name: 教师名称
        preferences: 用户偏好
        available_tools: 可用工具列表

    Returns:
        系统提示
    """
    prompt_parts = [get_default_prompt()]

    # 添加风格指导
    style_guide = get_style_guide(style)
    if style_guide:
        prompt_parts.append(f"\n## 对话风格\n{style_guide}")

    # 添加教师信息
    if teacher_name:
        prompt_parts.append(f"\n## 当前教师\n教师: {teacher_name}")

    # 添加偏好
    if preferences:
        pref_str = format_preferences(preferences)
        if pref_str:
            prompt_parts.append(f"\n## 用户偏好\n{pref_str}")

    # 添加工具列表
    if available_tools:
        tools_str = format_tools(available_tools)
        prompt_parts.append(f"\n## 可用工具\n{tools_str}")

    return "\n".join(prompt_parts)


def get_style_guide(style: str) -> str:
    """获取风格指导"""
    guides = {
        "专业助手": """
使用正式、精准的语言。
简洁明了，重点突出。
示例：已为您查询到 12 道题目。
""",
        "友好伙伴": """
使用亲切、温和的语言。
适当添加鼓励性语句。
示例：好的老师！我来帮您查询题目~
""",
        "可爱宠物": """
使用活泼、仓鼠语气。
适当添加「吱吱」等元素。
示例：吱吱！题目找好了！
""",
        "教育专家": """
提供专业建议和分析。
结合教育理论给出建议。
示例：已查询完成。建议这道题放在循环章节后教学。
"""
    }

    return guides.get(style, guides["专业助手"])


def format_preferences(preferences: Dict) -> str:
    """格式化偏好"""
    if not preferences:
        return ""

    parts = []
    for key, value in preferences.items():
        parts.append(f"- {key}: {value}")

    return "\n".join(parts)


def format_tools(tools: list) -> str:
    """格式化工具列表"""
    if not tools:
        return "无"

    parts = []
    for tool in tools:
        name = tool.get("name", "unknown")
        desc = tool.get("description", "")
        parts.append(f"- {name}: {desc}")

    return "\n".join(parts)


def get_permission_prompt() -> str:
    """获取权限提示"""
    return """
## 权限说明

- 查询操作：自由执行
- 创建操作：自由执行，简单提示
- 修改操作：需要管理员审批
- 删除操作：需要管理员审批

遇到敏感操作时，说明审批流程并提交申请。
"""


def get_intervention_prompt() -> str:
    """获取干预提示"""
    return """
## 干预处理

当需要用户干预时：
1. 清晰说明当前状态
2. 列出可选选项
3. 等待用户决定
4. 根据用户选择继续

不要猜测用户意图，在不确定时主动询问。
"""


def build_error_handling_prompt() -> str:
    """构建错误处理提示"""
    return """
## 错误处理

遇到错误时：
1. 说明错误原因
2. 提供可能的解决方案
3. 询问是否需要帮助

保持友好态度，不要让用户感到挫败。
"""


def build_context_prompt(context: Dict) -> str:
    """构建上下文提示"""
    parts = []

    if context.get("session_id"):
        parts.append(f"Session: {context['session_id']}")

    if context.get("workflow_type"):
        parts.append(f"工作流类型: {context['workflow_type']}")

    if context.get("previous_steps"):
        parts.append("已完成的步骤:")
        for step in context["previous_steps"]:
            parts.append(f"  - {step}")

    return "\n".join(parts) if parts else ""