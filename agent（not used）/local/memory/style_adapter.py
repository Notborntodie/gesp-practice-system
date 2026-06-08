"""
对话风格适配器

根据用户偏好调整 Agent 的对话风格。
"""

import logging
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger("style_adapter")


class StyleType(Enum):
    """对话风格类型"""
    PROFESSIONAL = "专业助手"
    FRIENDLY = "友好伙伴"
    CUTE = "可爱宠物"
    EXPERT = "教育专家"


class StyleAdapter:
    """
    对话风格适配器

    功能：
    - 根据风格模板调整响应
    - 处理不同场景的语气变化
    - 添加风格特定的元素
    """

    # 风格模板配置
    STYLE_CONFIGS = {
        StyleType.PROFESSIONAL: {
            "prefix": "",
            "suffix": "",
            "tone": "正式、精准",
            "example": "已为您查询到 12 道题目。",
            "error_handling": "抱歉，操作遇到问题，请稍后重试。",
            "waiting": "正在处理您的请求...",
            "success": "操作已完成。",
            "approval_needed": "此操作需要管理员审批，已提交申请。"
        },
        StyleType.FRIENDLY: {
            "prefix": "",
            "suffix": "",
            "tone": "亲切、温和",
            "example": "好的老师！我来帮您查询题目~",
            "error_handling": "哎呀，出了点小问题，我来帮您解决~",
            "waiting": "正在努力工作中...",
            "success": "搞定啦！",
            "approval_needed": "老师，这个操作需要管理员同意，我帮您申请啦~"
        },
        StyleType.CUTE: {
            "prefix": "吱吱！",
            "suffix": " 🐹",
            "tone": "活泼、仓鼠语气",
            "example": "吱吱！题目找好了！",
            "error_handling": "吱吱...出了点问题，我去看看~",
            "waiting": "吱吱吱~正在跑起来处理中...",
            "success": "吱吱！完成啦！开心~",
            "approval_needed": "吱吱，这个需要管理员叔叔同意，我去申请啦~"
        },
        StyleType.EXPERT: {
            "prefix": "",
            "suffix": "",
            "tone": "专业建议",
            "example": "已查询完成。建议：这道题适合放在循环章节后教学。",
            "error_handling": "遇到异常，建议您检查以下内容...",
            "waiting": "正在分析您的请求...",
            "success": "任务完成。如有需要，我可以提供进一步建议。",
            "approval_needed": "此操作涉及敏感资源，已提交审批申请。建议等待管理员确认后再进行。"
        }
    }

    def __init__(self, style: str = "专业助手"):
        self.style = self._parse_style(style)
        self.config = self.STYLE_CONFIGS.get(self.style, self.STYLE_CONFIGS[StyleType.PROFESSIONAL])

    def _parse_style(self, style: str) -> StyleType:
        """解析风格"""
        try:
            return StyleType(style)
        except ValueError:
            # 尝试匹配
            for s in StyleType:
                if s.value == style:
                    return s
            logger.warning(f"Unknown style: {style}, using default")
            return StyleType.PROFESSIONAL

    def set_style(self, style: str):
        """设置风格"""
        self.style = self._parse_style(style)
        self.config = self.STYLE_CONFIGS[self.style]
        logger.info(f"Style set to: {self.style.value}")

    def adapt_response(self, content: str, context: str = "normal") -> str:
        """
        适配响应内容

        Args:
            content: 原始内容
            context: 场景上下文

        Returns:
            适配后的内容
        """
        # 添加前缀
        prefix = self.config.get("prefix", "")

        # 添加后缀
        suffix = self.config.get("suffix", "")

        # 根据场景调整
        if context == "error":
            content = self.config.get("error_handling", content)
        elif context == "waiting":
            content = self.config.get("waiting", content)
        elif context == "success":
            content = self.config.get("success", content)
        elif context == "approval":
            content = self.config.get("approval_needed", content)

        return f"{prefix}{content}{suffix}"

    def get_system_prompt_addition(self) -> str:
        """获取系统提示补充"""
        tone = self.config.get("tone", "")

        addition = f"""
[对话风格指导]
请使用 {self.style.value} 风格进行对话。
风格特点：{tone}

示例：{self.config.get('example', '')}
"""

        if self.style == StyleType.CUTE:
            addition += "\n请使用仓鼠语气，可以适当添加「吱吱」等仓鼠语言元素。"

        return addition

    def format_waiting_message(self, task: str = "") -> str:
        """格式化等待消息"""
        waiting = self.config.get("waiting", "正在处理...")

        if task:
            return f"{waiting} {task}"

        return waiting

    def format_success_message(self, result: str = "") -> str:
        """格式化成功消息"""
        success = self.config.get("success", "完成")

        if result:
            return f"{success} {result}"

        return success

    def format_error_message(self, error: str) -> str:
        """格式化错误消息"""
        error_template = self.config.get("error_handling", "出错了")

        return f"{error_template}\n错误详情: {error}"

    def format_approval_message(self, action: str) -> str:
        """格式化审批消息"""
        approval = self.config.get("approval_needed", "需要审批")

        return f"{approval}\n操作: {action}"

    def format_step_message(self, step_name: str, step_num: int, total: int) -> str:
        """格式化步骤消息"""
        if self.style == StyleType.CUTE:
            return f"吱吱！正在做第 {step_num}/{total} 步：{step_name} 🐹"
        elif self.style == StyleType.FRIENDLY:
            return f"正在第 {step_num}/{total} 步：{step_name}~"
        elif self.style == StyleType.EXPERT:
            return f"步骤 {step_num}/{total}：{step_name}"
        else:
            return f"执行步骤 {step_num}/{total}: {step_name}"

    def format_intervention_request(self, reason: str) -> str:
        """格式化干预请求"""
        if self.style == StyleType.CUTE:
            return f"吱吱...需要老师看一下：{reason} 🐹"
        elif self.style == StyleType.FRIENDLY:
            return f"老师，这里需要您看一下：{reason}"
        elif self.style == StyleType.EXPERT:
            return f"需要您的干预：{reason}"
        else:
            return f"需要干预：{reason}"

    def get_style_name(self) -> str:
        """获取风格名称"""
        return self.style.value

    def get_available_styles(self) -> List[str]:
        """获取可用风格列表"""
        return [s.value for s in StyleType]

    def is_cute_style(self) -> bool:
        """是否是可爱风格"""
        return self.style == StyleType.CUTE

    def get_emoji(self) -> str:
        """获取风格表情"""
        if self.style == StyleType.CUTE:
            return "🐹"
        elif self.style == StyleType.FRIENDLY:
            return "😊"
        elif self.style == StyleType.EXPERT:
            return "📚"
        else:
            return ""