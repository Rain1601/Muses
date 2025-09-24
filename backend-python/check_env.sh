#!/bin/bash

# 环境状态检查脚本
# 快速检查项目环境是否正常

echo "========================================="
echo "🔍 Muses环境状态检查"
echo "========================================="

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

warn_status() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "1️⃣ Python环境检查"
echo "-------------------"

# 检查Python版本
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
echo "   Python版本: $PYTHON_VERSION"

# 检查虚拟环境
if [ -d "$PROJECT_DIR/venv" ]; then
    check_status 0 "虚拟环境存在: $PROJECT_DIR/venv"

    # 检查是否激活
    if [ -n "$VIRTUAL_ENV" ]; then
        check_status 0 "虚拟环境已激活: $VIRTUAL_ENV"
    else
        warn_status "虚拟环境未激活，运行: source ./activate.sh"
    fi
else
    check_status 1 "虚拟环境不存在，运行: ./setup_env.sh"
fi

echo ""
echo "2️⃣ 依赖检查"
echo "------------"

# 检查关键Python包
python3 -c "
import sys
packages = {
    'fastapi': 'FastAPI框架',
    'sqlalchemy': '数据库ORM',
    'chromadb': '向量数据库',
    'sentence_transformers': '文本嵌入',
    'openai': 'OpenAI API',
    'httpx': 'HTTP客户端',
    'uvicorn': 'ASGI服务器'
}

for pkg, desc in packages.items():
    try:
        __import__(pkg.replace('-', '_'))
        print(f'   ✅ {desc} ({pkg})')
    except ImportError:
        print(f'   ❌ {desc} ({pkg}) - 未安装')
"

echo ""
echo "3️⃣ 配置文件检查"
echo "---------------"

# 检查.env文件
if [ -f "$PROJECT_DIR/.env" ]; then
    check_status 0 ".env配置文件存在"

    # 检查关键配置
    if grep -q "DATABASE_URL" "$PROJECT_DIR/.env"; then
        check_status 0 "数据库配置已设置"
    else
        warn_status "数据库配置未设置"
    fi

    if grep -q "JWT_SECRET" "$PROJECT_DIR/.env"; then
        check_status 0 "JWT密钥已配置"
    else
        warn_status "JWT密钥未配置"
    fi
else
    check_status 1 ".env配置文件不存在"
fi

echo ""
echo "4️⃣ 目录结构检查"
echo "---------------"

# 检查必要目录
dirs=("uploads" "knowledge_db" "chroma_db")
for dir in "${dirs[@]}"; do
    if [ -d "$PROJECT_DIR/$dir" ]; then
        check_status 0 "目录存在: $dir"
    else
        warn_status "目录不存在: $dir (将自动创建)"
    fi
done

echo ""
echo "5️⃣ 服务状态检查"
echo "---------------"

# 检查后端服务
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:8080/api/health)
    check_status 0 "后端服务运行中: http://localhost:8080"
    echo "   响应: $HEALTH"
else
    warn_status "后端服务未运行，运行: ./start_with_env.sh"
fi

# 检查前端服务
if curl -s http://localhost:3004 > /dev/null 2>&1; then
    check_status 0 "前端服务运行中: http://localhost:3004"
else
    warn_status "前端服务未运行"
fi

echo ""
echo "========================================="
echo "检查完成！"
echo ""
echo "快速命令："
echo "  配置环境: ./setup_env.sh"
echo "  激活环境: source ./activate.sh"
echo "  启动后端: ./start_with_env.sh"
echo "  测试RAG: ./test_rag_cli.sh"
echo "========================================="