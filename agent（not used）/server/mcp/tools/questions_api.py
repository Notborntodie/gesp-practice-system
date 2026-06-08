"""
题目相关 MCP Tools

包装 Backend questions API。
"""

import logging
from typing import Dict, Any
from datetime import datetime

from server.mcp.tools import register_tool
from server.backend_client.client import BackendClient

logger = logging.getLogger("questions_tools")

# Backend Client
backend = BackendClient()


# ============================================================
# 查询题目
# ============================================================
async def list_questions(params: Dict, user_info: Dict) -> Dict:
    """查询题目列表"""
    level = params.get("level")
    category = params.get("category")
    type = params.get("type")
    keyword = params.get("keyword")
    page = params.get("page", 1)
    limit = params.get("limit", 20)

    response = await backend.get("/api/questions", params={
        "level": level,
        "category": category,
        "type": type,
        "keyword": keyword,
        "page": page,
        "limit": limit
    })

    # Backend 可能直接返回 list 或返回 {data: [...]}
    if isinstance(response, list):
        questions = response
        total = len(response)
    else:
        questions = response.get("data", [])
        total = response.get("total", len(questions))

    return {
        "questions": questions,
        "total": total,
        "page": page
    }


register_tool(
    "list_questions",
    list_questions,
    description="查询题目列表",
    params_schema={
        "level": {"type": "int", "optional": True, "description": "等级"},
        "category": {"type": "string", "optional": True, "description": "类别"},
        "type": {"type": "string", "optional": True, "description": "类型：oj/objective"},
        "keyword": {"type": "string", "optional": True, "description": "关键词"},
        "page": {"type": "int", "optional": True, "default": 1},
        "limit": {"type": "int", "optional": True, "default": 20}
    }
)


# ============================================================
# 获取题目详情
# ============================================================
async def get_question(params: Dict, user_info: Dict) -> Dict:
    """获取题目详情"""
    question_id = params.get("question_id")
    if not question_id:
        return {"error": "缺少 question_id"}

    response = await backend.get(f"/api/questions/{question_id}")

    return response


register_tool(
    "get_question",
    get_question,
    description="获取题目详情",
    params_schema={
        "question_id": {"type": "int", "required": True, "description": "题目ID"}
    }
)


# ============================================================
# 创建题目
# ============================================================
async def create_question(params: Dict, user_info: Dict) -> Dict:
    """创建题目"""
    # Backend API使用 /api/upload-question 端点
    # 参数名不同：question_text而非title
    question_text = params.get("title") or params.get("question_text")
    level = params.get("level", 2)
    type = params.get("type", "oj")
    category = params.get("category", "GESP")
    difficulty = params.get("difficulty", "medium")
    description = params.get("description", "")
    correct_answer = params.get("correct_answer", "")
    explanation = params.get("explanation", "")

    if not question_text:
        return {"error": "缺少题目内容（title或question_text）"}

    # 根据类型设置参数
    if type == "oj":
        # OJ题目需要代码相关参数
        question_code = params.get("question_code")
        response = await backend.post("/api/upload-question", data={
            "question_text": question_text,
            "question_type": "code",
            "question_code": question_code,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "level": level,
            "category": category,
            "difficulty": difficulty,
            "knowledge_point_ids": params.get("knowledge_point_ids", [])
        })
    else:
        # 客观题
        response = await backend.post("/api/upload-question", data={
            "question_text": question_text,
            "question_type": "text",
            "correct_answer": correct_answer,
            "explanation": explanation,
            "level": level,
            "category": category,
            "difficulty": difficulty,
            "options": params.get("options", []),
            "knowledge_point_ids": params.get("knowledge_point_ids", [])
        })

    # Backend返回的是 questionId，不是 id
    question_id = response.get("questionId") or response.get("id")

    if response.get("error"):
        return {"error": response.get("error"), "details": response.get("details")}

    return {
        "question_id": question_id,
        "message": "题目创建成功",
        "success": True
    }


register_tool(
    "create_question",
    create_question,
    description="创建新题目",
    params_schema={
        "title": {"type": "string", "required": True, "description": "题目内容"},
        "level": {"type": "int", "default": 2, "description": "等级(1-7)"},
        "type": {"type": "string", "default": "oj", "options": ["oj", "objective"], "description": "题目类型"},
        "category": {"type": "string", "default": "GESP", "description": "类别"},
        "difficulty": {"type": "string", "default": "medium", "options": ["easy", "medium", "hard"], "description": "难度"},
        "correct_answer": {"type": "string", "optional": True, "description": "正确答案"},
        "explanation": {"type": "string", "optional": True, "description": "解析"},
        "options": {"type": "array", "optional": True, "description": "客观题选项"},
        "knowledge_point_ids": {"type": "array", "optional": True, "description": "知识点ID列表"}
    }
)


# ============================================================
# 更新题目（需审批）
# ============================================================
async def update_question(params: Dict, user_info: Dict) -> Dict:
    """更新题目（敏感操作）"""
    # 超级管理员直接执行
    if user_info.get("bypass_approval") or user_info.get("is_super_admin"):
        question_id = params.get("question_id")
        if not question_id:
            return {"error": "缺少 question_id"}

        update_data = params.get("update_data", {})
        response = await backend.put(f"/api/questions/{question_id}", data=update_data)
        return {"question_id": question_id, "message": "题目更新成功", "success": True}

    # 普通用户需要审批
    return {"approval_required": True}


register_tool(
    "update_question",
    update_question,
    description="更新题目（需审批）",
    params_schema={
        "question_id": {"type": "int", "required": True},
        "title": {"type": "string", "optional": True},
        "description": {"type": "string", "optional": True}
    }
)


# ============================================================
# 删除题目（需审批）
# ============================================================
async def delete_question(params: Dict, user_info: Dict) -> Dict:
    """删除题目（敏感操作）"""
    # 超级管理员直接执行
    if user_info.get("bypass_approval") or user_info.get("is_super_admin"):
        question_id = params.get("question_id")
        if not question_id:
            return {"error": "缺少 question_id"}

        # 软删除：标记 deleted_at
        response = await backend.put(f"/api/questions/{question_id}", data={
            "deleted_at": datetime.now().isoformat(),
            "deleted_by": user_info["user_id"]
        })
        return {"question_id": question_id, "message": "题目已删除", "success": True}

    # 普通用户需要审批
    return {"approval_required": True}


register_tool(
    "delete_question",
    delete_question,
    description="删除题目（需审批）",
    params_schema={
        "question_id": {"type": "int", "required": True}
    }
)


# ============================================================
# 执行审批后的更新（内部调用）
# ============================================================
async def execute_update_question(params: Dict, user_info: Dict) -> Dict:
    """执行审批后的更新"""
    question_id = params.get("question_id")
    update_data = params.get("update_data", {})

    response = await backend.put(f"/api/questions/{question_id}", data=update_data)

    return {
        "question_id": question_id,
        "message": "题目更新成功"
    }


register_tool(
    "_execute_update_question",
    execute_update_question,
    description="执行更新题目（审批后）",
    params_schema={}
)


# ============================================================
# 执行审批后的删除（内部调用）
# ============================================================
async def execute_delete_question(params: Dict, user_info: Dict) -> Dict:
    """执行审批后的删除（软删除）"""
    question_id = params.get("question_id")

    # 软删除：标记 deleted_at
    response = await backend.put(f"/api/questions/{question_id}", data={
        "deleted_at": "NOW()",
        "deleted_by": user_info["user_id"]
    })

    return {
        "question_id": question_id,
        "message": "题目已删除（软删除）"
    }


register_tool(
    "_execute_delete_question",
    execute_delete_question,
    description="执行删除题目（审批后）",
    params_schema={}
)


def register_questions_tools():
    """注册题目相关 Tools"""
    pass