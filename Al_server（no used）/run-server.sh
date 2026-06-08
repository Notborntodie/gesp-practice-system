#!/bin/bash
# 核心启动脚本 - 所有启动方式都使用这个脚本
# 确保完全独立于SSH会话

set -e

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 加载 .env 文件（如果存在）
if [ -f ".env" ]; then
    echo "📋 从 .env 文件加载环境变量..."
    # 使用 source 或 export 加载 .env 文件
    set -a  # 自动导出所有变量
    source .env
    set +a  # 关闭自动导出
    echo "✅ 环境变量加载完成"
else
    echo "⚠️  警告: .env 文件不存在，使用默认配置"
    echo "💡 提示: 复制 env.example 为 .env 并配置 API 密钥"
fi

# 检查 API 密钥是否已设置
if [ -z "$DASHSCOPE_API_KEY" ] || [ "$DASHSCOPE_API_KEY" = "your_dashscope_api_key_here" ]; then
    echo "❌ 错误: DASHSCOPE_API_KEY 未配置或使用默认值"
    echo "   请创建 .env 文件并设置正确的 API 密钥"
    echo "   示例: cp env.example .env"
    echo "   然后编辑 .env 文件，设置 DASHSCOPE_API_KEY=your_actual_api_key"
    exit 1
fi

# 检查模型配置（如果未设置，使用默认值）
if [ -z "$LLM_MODEL" ]; then
    export LLM_MODEL="qwen-plus-latest"
    echo "ℹ️  使用默认模型: $LLM_MODEL"
else
    echo "✅ 使用模型: $LLM_MODEL"
fi

# 显示配置信息
echo "📋 配置信息:"
echo "   API密钥: ${DASHSCOPE_API_KEY:0:10}...${DASHSCOPE_API_KEY: -4}"
echo "   模型: $LLM_MODEL"

# 设置其他环境变量
export PYTHONUNBUFFERED=1
export PATH="$(pwd)/venv/bin:$PATH"

# 记录启动日志
echo "========================================" >> server.log
echo "服务启动时间: $(date)" >> server.log
echo "工作目录: $(pwd)" >> server.log
echo "Python路径: $(which python)" >> server.log
echo "Uvicorn路径: $(which uvicorn)" >> server.log
echo "========================================" >> server.log

# 启动服务（仅本机访问，由 Nginx 反向代理 /ai-api/ 对外）
exec $(pwd)/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000






