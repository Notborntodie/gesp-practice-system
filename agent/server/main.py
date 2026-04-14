"""
MCP Server 主入口

云端 MCP Server，包装 Backend API 为 MCP Tools。
"""

import asyncio
import logging
import os
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.mcp.tools import register_all_tools
from server.approval.manager import ApprovalManager
from server.scheduler.task_manager import TaskManager

# ============================================================
# 日志配置
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("mcp_server")

# ============================================================
# 全局状态
# ============================================================
approval_manager: ApprovalManager = None
task_manager: TaskManager = None


# ============================================================
# FastAPI 应用（Python 3.6 兼容）
# ============================================================
app = FastAPI(
    title="GESP MCP Server",
    description="云端 MCP Server，为 Agent 提供 Backend API 包装",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 启动/关闭事件（Python 3.6 兼容）
# ============================================================
@app.on_event("startup")
async def startup_event():
    """启动事件"""
    global approval_manager, task_manager

    logger.info("MCP Server 启动...")

    # 初始化审批管理器
    approval_manager = ApprovalManager()
    await approval_manager.initialize()
    app.state.approval_manager = approval_manager

    # 初始化任务调度器
    task_manager = TaskManager()
    await task_manager.initialize()
    app.state.task_manager = task_manager

    # 注册 MCP Tools
    register_all_tools(app)

    logger.info("MCP Server 启动完成")


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    global task_manager

    logger.info("MCP Server 关闭...")
    if task_manager:
        await task_manager.shutdown()
    logger.info("MCP Server 已关闭")


# ============================================================
# API Models
# ============================================================
class MCPToolRequest(BaseModel):
    """MCP Tool 调用请求"""
    tool: str
    params: dict = {}
    user_key: str = None  # 可选，优先从header获取


class MCPToolResponse(BaseModel):
    """MCP Tool 响应"""
    success: bool
    result: dict = {}
    error: str = None


class ApprovalRequest(BaseModel):
    """审批请求"""
    teacher_id: int
    action: str
    resource_type: str = None
    resource_id: int = None
    params: dict = {}


class ApprovalDecision(BaseModel):
    """审批决策"""
    approval_id: int
    admin_id: int
    decision: str  # "approve" / "reject"
    reason: str = ""


# ============================================================
# 健康检查
# ============================================================
@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


# ============================================================
# MCP Tool 调用端点
# ============================================================
@app.post("/mcp/call", response_model=MCPToolResponse)
async def call_tool(request: MCPToolRequest, http_request: Request):
    """调用 MCP Tool"""

    # 获取用户 Key：优先从header获取，其次从body获取
    user_key = http_request.headers.get("X-MCP-Key") or request.user_key

    if not user_key:
        raise HTTPException(status_code=401, detail="缺少认证信息（X-MCP-Key header 或 user_key body）")

    # 验证用户 Key
    user_info = await verify_user_key(user_key)
    if not user_info:
        raise HTTPException(status_code=401, detail="无效的用户 Key")

    # 获取 Tool
    tool_registry = app.state.tool_registry
    tool_handler = tool_registry.get(request.tool)

    if not tool_handler:
        return MCPToolResponse(
            success=False,
            error=f"未知工具: {request.tool}"
        )

    # 检查权限
    permission_check = check_permission(
        user_info,
        request.tool,
        request.params
    )

    if permission_check["need_approval"]:
        # 敏感操作，提交审批
        approval_id = await app.state.approval_manager.create_request(
            teacher_id=user_info["user_id"],
            action=request.tool,
            params=request.params
        )
        return MCPToolResponse(
            success=False,
            result={"approval_required": True, "approval_id": approval_id},
            error="敏感操作，需要管理员审批"
        )

    # 执行 Tool
    try:
        result = await tool_handler(request.params, user_info)
        return MCPToolResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Tool {request.tool} 执行失败: {e}")
        return MCPToolResponse(success=False, error=str(e))


# ============================================================
# 工具列表端点
# ============================================================
@app.get("/mcp/tools")
async def list_tools():
    """列出所有 MCP Tools"""
    tool_registry = app.state.tool_registry
    tools = []

    for name, handler in tool_registry.items():
        tools.append({
            "name": name,
            "description": getattr(handler, "description", ""),
            "params": getattr(handler, "params_schema", {})
        })

    return {"tools": tools}


# ============================================================
# 审批端点
# ============================================================
@app.post("/approval/create")
async def create_approval(request: ApprovalRequest):
    """创建审批请求"""
    approval_id = await app.state.approval_manager.create_request(
        teacher_id=request.teacher_id,
        action=request.action,
        resource_type=request.resource_type,
        resource_id=request.resource_id,
        params=request.params
    )

    return {
        "approval_id": approval_id,
        "status": "pending"
    }


@app.get("/approval/status/{approval_id}")
async def get_approval_status(approval_id: int):
    """获取审批状态"""
    approval = await app.state.approval_manager.get_request(approval_id)

    if not approval:
        raise HTTPException(status_code=404, detail="审批不存在")

    return approval


@app.post("/approval/decide")
async def decide_approval(request: ApprovalDecision):
    """审批决策"""
    if request.decision == "approve":
        result = await app.state.approval_manager.approve(
            approval_id=request.approval_id,
            admin_id=request.admin_id,
            reason=request.reason
        )
    else:
        result = await app.state.approval_manager.reject(
            approval_id=request.approval_id,
            admin_id=request.admin_id,
            reason=request.reason
        )

    return result


@app.get("/approval/pending")
async def list_pending_approvals():
    """列出待审批请求"""
    pending = await app.state.approval_manager.get_pending_requests()
    return {"approvals": pending}


# ============================================================
# 辅助函数
# ============================================================
from server.auth import auth_manager

async def verify_user_key(user_key: str) -> dict:
    """验证用户 MCP Key"""
    return await auth_manager.verify_user_key(user_key)


def check_permission(user_info: dict, tool: str, params: dict) -> dict:
    """检查权限"""
    return auth_manager.check_permission(user_info, tool, params)


# ============================================================
# 启动
# ============================================================
def main():
    """主入口"""
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,  # 开发模式
        log_level="info"
    )


if __name__ == "__main__":
    main()