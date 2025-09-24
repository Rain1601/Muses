#!/bin/bash

# Muses后端启动脚本（带环境检查）
# 确保使用正确的虚拟环境

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$PROJECT_DIR/venv"

echo "========================================="
echo "🚀 启动Muses后端服务"
echo "========================================="

# 1. 检查虚拟环境
if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "❌ 未找到虚拟环境"
    echo "   请先运行: ./setup_env.sh"
    exit 1
fi

# 2. 激活虚拟环境
echo ""
echo "📍 激活虚拟环境..."
source "$VENV_DIR/bin/activate"
echo "   Python: $(which python3)"

# 3. 检查依赖
echo ""
echo "📍 检查关键依赖..."
python3 -c "
import sys
try:
    import fastapi
    import sqlalchemy
    import chromadb
    import sentence_transformers
    print('   ✅ 所有关键依赖已安装')
except ImportError as e:
    print(f'   ❌ 缺少依赖: {e}')
    print('   请运行: pip install -r requirements.txt')
    sys.exit(1)
"

# 4. 检查.env文件
echo ""
echo "📍 检查配置文件..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "   ❌ 未找到.env文件"
    echo "   请创建.env文件并配置必要的环境变量"
    exit 1
else
    echo "   ✅ .env文件已存在"
fi

# 5. 启动服务
echo ""
echo "📍 启动FastAPI服务..."
echo "========================================="
echo ""

cd "$PROJECT_DIR"
python3 start.py