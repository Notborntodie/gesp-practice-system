"""
权限级别定义
"""

from enum import Enum


class RoleType(Enum):
    """角色类型"""
    TEACHER = "teacher"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class ApprovalType(Enum):
    """审批类型"""
    ADMIN = "admin"           # 管理员审批
    SUPER_ADMIN = "super_admin"  # 超级管理员审批


class OperationType(Enum):
    """操作类型分类"""
    # 查询类
    QUERY = "query"
    # 创建类
    CREATE = "create"
    # 修改类
    UPDATE = "update"
    # 删除类
    DELETE = "delete"


# 资源类型
RESOURCE_TYPES = [
    "question",
    "exam",
    "learning_plan",
    "student",
    "teacher"
]


# 操作与资源类型映射
OPERATION_RESOURCE_MAP = {
    "list_questions": "question",
    "get_question": "question",
    "create_question": "question",
    "update_question": "question",
    "delete_question": "question",

    "list_exams": "exam",
    "get_exam": "exam",
    "create_exam": "exam",
    "update_exam": "exam",
    "delete_exam": "exam",

    "list_learning_plans": "learning_plan",
    "get_learning_plan": "learning_plan",
    "create_learning_plan": "learning_plan",
    "update_learning_plan": "learning_plan",
    "delete_learning_plan": "learning_plan",

    "list_students": "student",
    "get_student_progress": "student",
}


# 软删除配置
SOFT_DELETE_CONFIG = {
    "enabled": True,
    "recovery_window_hours": 48,  # 48小时恢复窗口
    "tables": [
        "questions",
        "exams",
        "learning_plans"
    ]
}