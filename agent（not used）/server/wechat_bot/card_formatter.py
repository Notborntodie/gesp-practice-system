"""
微信卡片格式化器

格式化各类消息为微信卡片格式。
"""

import logging
from typing import Dict, List, Any

logger = logging.getLogger("card_formatter")


class CardFormatter:
    """
    微信卡片格式化器

    功能：
    - 格式化审批卡片
    - 格式化统计卡片
    - 格式化提醒卡片
    - 格式化题目卡片
    """

    def format_approval_card(
        self,
        approval_id: int,
        action: str,
        teacher_name: str,
        status: str,
        details: str = None,
        url: str = None
    ) -> Dict:
        """
        格式化审批卡片

        Args:
            approval_id: 审批 ID
            action: 操作类型
            teacher_name: 教师姓名
            status: 状态
            details: 详情
            url: 链接

        Returns:
            卡片内容
        """
        status_color = {
            "pending": "warning",
            "approved": "success",
            "rejected": "danger",
            "executed": "success"
        }

        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": f"审批通知 #{approval_id}",
                "desc": status
            },
            "emphasis_content": {
                "title": action,
                "desc": f"提交者: {teacher_name}"
            },
            "sub_title_text": f"状态: {status}"
        }

        if details:
            card["card_image"] = {
                "url": "",
                "aspect_ratio": 1
            }
            card["horizontal_content_list"] = [
                {"keyname": "详情", "value": details[:50]}
            ]

        if url:
            card["card_action"] = {
                "type": 1,
                "url": url
            }

        return card

    def format_summary_card(
        self,
        teacher_name: str,
        stats: Dict,
        highlights: List[str] = None
    ) -> Dict:
        """
        格式化摘要卡片

        Args:
            teacher_name: 教师姓名
            stats: 统计数据
            highlights: 亮点列表

        Returns:
            卡片内容
        """
        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": f"{teacher_name} 的每日摘要",
                "desc": datetime.now().strftime("%Y-%m-%d")
            },
            "emphasis_content": {
                "title": f"AI 交互 {stats.get('ai_interactions', 0)} 次",
                "desc": "今日工作"
            },
            "horizontal_content_list": [
                {"keyname": "题目", "value": str(stats.get("questions_created", 0))},
                {"keyname": "考试", "value": str(stats.get("exams_created", 0))},
                {"keyname": "查询", "value": str(stats.get("student_queries", 0))}
            ]
        }

        if highlights:
            card["sub_title_text"] = "亮点: " + ", ".join(highlights[:3])

        return card

    def format_reminder_card(
        self,
        reminder_type: str,
        details: str,
        priority: str = "normal"
    ) -> Dict:
        """
        格式化提醒卡片

        Args:
            reminder_type: 提醒类型
            details: 详情
            priority: 优先级

        Returns:
            卡片内容
        """
        priority_style = {
            "high": {"title": "⚠️ 重要提醒", "color": "warning"},
            "normal": {"title": "📋 提醒", "color": "normal"},
            "low": {"title": "💡 提示", "color": "info"}
        }

        style = priority_style.get(priority, priority_style["normal"])

        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": style["title"],
                "desc": reminder_type
            },
            "sub_title_text": details[:100]
        }

        return card

    def format_question_card(
        self,
        question_id: int,
        title: str,
        difficulty: str,
        category: str,
        url: str = None
    ) -> Dict:
        """
        格式化题目卡片

        Args:
            question_id: 题目 ID
            title: 标题
            difficulty: 难度
            category: 类别
            url: 链接

        Returns:
            卡片内容
        """
        difficulty_color = {
            "easy": "info",
            "medium": "warning",
            "hard": "danger"
        }

        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": f"题目 #{question_id}",
                "desc": title[:30]
            },
            "horizontal_content_list": [
                {"keyname": "难度", "value": difficulty},
                {"keyname": "类别", "value": category}
            ]
        }

        if url:
            card["card_action"] = {
                "type": 1,
                "url": url
            }
            card["button_selection"] = {
                "text": "查看详情",
                "type": 1,
                "url": url
            }

        return card

    def format_student_card(
        self,
        student_name: str,
        grade: str,
        progress: Dict,
        url: str = None
    ) -> Dict:
        """
        格式化学生卡片

        Args:
            student_name: 学生姓名
            grade: 年级
            progress: 进度数据
            url: 链接

        Returns:
            卡片内容
        """
        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": f"学生: {student_name}",
                "desc": f"年级: {grade}"
            },
            "horizontal_content_list": [
                {"keyname": "完成", "value": str(progress.get("completed", 0))},
                {"keyname": "进度", "value": f"{progress.get('percent', 0)}%"}
            ],
            "sub_title_text": f"最近活跃: {progress.get('last_active', '未知')}"
        }

        if url:
            card["card_action"] = {
                "type": 1,
                "url": url
            }

        return card

    def format_error_card(
        self,
        error_type: str,
        message: str,
        suggestion: str = None
    ) -> Dict:
        """
        格式化错误卡片

        Args:
            error_type: 错误类型
            message: 错误消息
            suggestion: 建议

        Returns:
            卡片内容
        """
        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": "❌ 错误",
                "desc": error_type
            },
            "sub_title_text": message[:100]
        }

        if suggestion:
            card["horizontal_content_list"] = [
                {"keyname": "建议", "value": suggestion[:50]}
            ]

        return card

    def format_list_card(
        self,
        title: str,
        items: List[Dict],
        total: int = None
    ) -> Dict:
        """
        格式化列表卡片

        Args:
            title: 标题
            items: 列表项
            total: 总数

        Returns:
            卡片内容
        """
        # 取前 5 项
        display_items = items[:5]

        horizontal_list = []
        for item in display_items:
            horizontal_list.append({
                "keyname": item.get("key", ""),
                "value": str(item.get("value", ""))
            })

        card = {
            "card_type": "text_notice",
            "main_title": {
                "title": title,
                "desc": f"共 {total or len(items)} 项"
            },
            "horizontal_content_list": horizontal_list
        }

        return card

    def to_markdown(self, card: Dict) -> str:
        """
        将卡片转换为 Markdown

        Args:
            card: 卡片内容

        Returns:
            Markdown 文本
        """
        lines = []

        # 主标题
        main_title = card.get("main_title", {})
        if main_title.get("title"):
            lines.append(f"**{main_title['title']}**")

        if main_title.get("desc"):
            lines.append(f"> {main_title['desc']}")

        # 强调内容
        emphasis = card.get("emphasis_content", {})
        if emphasis.get("title"):
            lines.append(f"\n**{emphasis['title']}**")

        if emphasis.get("desc"):
            lines.append(f"{emphasis['desc']}")

        # 水平内容列表
        horizontal = card.get("horizontal_content_list", [])
        if horizontal:
            lines.append("\n| 属性 | 值 |")
            lines.append("|------|-----|")
            for item in horizontal:
                lines.append(f"| {item.get('keyname', '')} | {item.get('value', '')} |")

        # 子标题
        if card.get("sub_title_text"):
            lines.append(f"\n{card['sub_title_text']}")

        return "\n".join(lines)


# 导入 datetime
from datetime import datetime