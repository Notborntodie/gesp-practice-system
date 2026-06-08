#!/bin/bash
# 停止服务脚本 - 改进版，会检查端口占用

cd "$(dirname "$0")"

STOPPED=false

# 1. 检查并停止 server.pid 中的进程
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "🛑 停止服务 (PID: $PID)..."
        kill $PID 2>/dev/null
        
        # 等待进程结束
        for i in {1..10}; do
            if ! ps -p $PID > /dev/null 2>&1; then
                echo "✅ 进程 $PID 已停止"
                STOPPED=true
                break
            fi
            sleep 1
        done
        
        # 如果还在运行，强制停止
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️  强制停止进程 $PID..."
            kill -9 $PID 2>/dev/null
            sleep 1
            STOPPED=true
        fi
    else
        echo "⚠️  PID文件中的进程 $PID 不存在，清理 PID 文件"
    fi
    rm -f server.pid
fi

# 2. 检查并停止占用8000端口的进程
PORT=8000
echo "🔍 检查端口 $PORT 占用情况..."

# 尝试使用 lsof 查找占用端口的进程
if command -v lsof > /dev/null 2>&1; then
    PIDS=$(lsof -ti :$PORT 2>/dev/null)
elif command -v netstat > /dev/null 2>&1; then
    PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-' | sort -u)
elif command -v ss > /dev/null 2>&1; then
    PIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
else
    # 使用 ps 和 grep 查找 uvicorn 进程
    PIDS=$(ps aux | grep -E "uvicorn.*main:app.*port.*$PORT|uvicorn.*--port.*$PORT" | grep -v grep | awk '{print $2}')
fi

if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            echo "🛑 发现占用端口 $PORT 的进程 (PID: $PID)，正在停止..."
            kill $PID 2>/dev/null
            
            # 等待进程结束
            for i in {1..5}; do
                if ! ps -p $PID > /dev/null 2>&1; then
                    echo "✅ 进程 $PID 已停止"
                    STOPPED=true
                    break
                fi
                sleep 1
            done
            
            # 如果还在运行，强制停止
            if ps -p $PID > /dev/null 2>&1; then
                echo "⚠️  强制停止进程 $PID..."
                kill -9 $PID 2>/dev/null
                sleep 1
                STOPPED=true
            fi
        fi
    done
fi

# 3. 再次检查端口是否已释放
sleep 1
if command -v lsof > /dev/null 2>&1; then
    REMAINING=$(lsof -ti :$PORT 2>/dev/null)
elif command -v netstat > /dev/null 2>&1; then
    REMAINING=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-' | sort -u)
elif command -v ss > /dev/null 2>&1; then
    REMAINING=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
else
    REMAINING=$(ps aux | grep -E "uvicorn.*main:app.*port.*$PORT|uvicorn.*--port.*$PORT" | grep -v grep | awk '{print $2}')
fi

if [ -n "$REMAINING" ]; then
    echo "⚠️  仍有进程占用端口 $PORT: $REMAINING"
    echo "   尝试强制停止..."
    for PID in $REMAINING; do
        kill -9 $PID 2>/dev/null
    done
    sleep 1
    STOPPED=true
fi

# 4. 显示结果
if [ "$STOPPED" = true ]; then
    echo "✅ 服务已停止"
else
    echo "ℹ️  未发现运行中的服务"
fi
