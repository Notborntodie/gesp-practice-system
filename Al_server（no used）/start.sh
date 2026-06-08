#!/bin/bash
# 统一启动脚本 - 简化版
# 从 .env 文件加载配置并启动服务

cd "$(dirname "$0")"

# 检查是否已经在运行（通过PID文件）
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "❌ 服务已经在运行中 (PID: $PID)"
        echo "如需重启，请先运行: ./stop.sh"
        exit 1
    fi
fi

# 检查端口8000是否被占用
PORT=8000
if command -v lsof > /dev/null 2>&1; then
    PORT_PID=$(lsof -ti :$PORT 2>/dev/null)
elif command -v netstat > /dev/null 2>&1; then
    PORT_PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-' | head -1)
elif command -v ss > /dev/null 2>&1; then
    PORT_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
else
    PORT_PID=$(ps aux | grep -E "uvicorn.*main:app.*port.*$PORT|uvicorn.*--port.*$PORT" | grep -v grep | awk '{print $2}' | head -1)
fi

if [ -n "$PORT_PID" ] && ps -p $PORT_PID > /dev/null 2>&1; then
    echo "❌ 端口 $PORT 已被占用 (PID: $PORT_PID)"
    echo "   请先运行: ./stop.sh"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "   请先创建配置文件: cp env.example .env"
    echo "   然后编辑 .env 文件，设置 DASHSCOPE_API_KEY 和 LLM_MODEL"
    exit 1
fi

echo "🚀 启动AI服务器..."

# 使用 run-server.sh 启动服务
# 确保在 Al_server 目录下执行（支持从项目根或 Al_server 内运行）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
setsid bash -c '
    cd "'"$SCRIPT_DIR"'"
    nohup ./run-server.sh >> server.log 2>&1 &
    echo $! > server.pid
' &

# 等待进程启动
sleep 2

# 检查是否启动成功
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ 服务已在后台启动"
        echo "📝 进程ID: $PID"
        echo "📋 日志文件: server.log"
        echo "🌐 服务地址: http://127.0.0.1:8000（仅本机，由 Nginx /ai-api/ 代理）"
        echo ""
        echo "提示："
        echo "  查看日志: tail -f server.log"
        echo "  停止服务: ./stop.sh"
        echo "  查看状态: ps aux | grep uvicorn"
    else
        echo "❌ 服务启动失败，请查看日志: tail -f server.log"
        exit 1
    fi
else
    echo "❌ 服务启动失败，未能创建PID文件"
    exit 1
fi
