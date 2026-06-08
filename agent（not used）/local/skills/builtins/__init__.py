"""
内置 Skills 模块入口
"""

from local.skills.builtins.create_question import CreateQuestionSkill
from local.skills.builtins.create_exam import CreateExamSkill
from local.skills.builtins.query_student import QueryStudentSkill

__all__ = ["CreateQuestionSkill", "CreateExamSkill", "QueryStudentSkill"]