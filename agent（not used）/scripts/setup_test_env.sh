#!/bin/bash
# GESP Agent 测试环境一键设置脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "GESP Agent 测试环境设置"
echo "======================================"
echo ""

# 检查 Python 版本
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "检测到 Python 版本: $PYTHON_VERSION"

if [[ "$PYTHON_VERSION" < "3.8" ]]; then
    echo "错误: 需要 Python 3.8+"
    exit 1
fi

# 进入项目目录
cd "$PROJECT_DIR"

# 创建虚拟环境
if [ -d "venv" ]; then
    echo "虚拟环境已存在，跳过创建"
else
    echo "创建虚拟环境..."
    python3 -m venv venv
    echo "虚拟环境创建成功: $PROJECT_DIR/venv"
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 升级 pip
echo "升级 pip..."
pip install --upgrade pip

# 安装测试依赖
echo "安装测试依赖..."
if [ -f "requirements-test.txt" ]; then
    pip install -r requirements-test.txt
else
    echo "警告: requirements-test.txt 不存在"
    echo "安装核心测试依赖..."
    pip install pytest pytest-asyncio pytest-mock pytest-cov httpx responses faker
fi

# 验证安装
echo ""
echo "验证安装..."
python -c "import pytest; print('pytest:', pytest.__version__)"
python -c "import asyncio; print('asyncio: OK')"
python -c "import httpx; print('httpx:', httpx.__version__)"

# 创建测试数据库（可选）
echo ""
echo "测试数据库设置（可选）："
echo "  mysql -u root -p gesp_agent_test < tests/fixtures/test_data.sql"

# 运行验证测试
echo ""
echo "运行验证测试..."
pytest tests/unit/local/core/test_engine.py -v --tb=short || echo "验证测试完成（可能需要实际实现后才能通过）"

echo ""
echo "======================================"
echo "设置完成！"
echo "======================================"
echo ""
echo "使用方法："
echo "  1. 激活环境: source $PROJECT_DIR/venv/bin/activate"
echo "  2. 运行测试: pytest tests/unit -v"
echo "  3. 退出环境: deactivate"
echo ""