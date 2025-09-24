#!/bin/bash

# Muses项目Python环境配置脚本
# 确保项目有独立的虚拟环境和正确的依赖

set -e  # 出错时停止执行

echo "========================================="
echo "🚀 Muses Python环境配置"
echo "========================================="

# 项目根目录
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$PROJECT_DIR/venv"

# 1. 检查Python版本
echo ""
echo "📍 检查Python版本..."
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
echo "   当前Python版本: $PYTHON_VERSION"

if [[ $(echo "$PYTHON_VERSION < 3.10" | bc) -eq 1 ]]; then
    echo "❌ 错误: 需要Python 3.10或更高版本"
    exit 1
fi

# 2. 创建或激活虚拟环境
if [ -d "$VENV_DIR" ]; then
    echo ""
    echo "📍 发现现有虚拟环境"
    echo -n "   是否重新创建? (y/N): "
    read -r RECREATE
    if [[ $RECREATE =~ ^[Yy]$ ]]; then
        echo "   删除旧环境..."
        rm -rf "$VENV_DIR"
        echo "   创建新虚拟环境..."
        python3 -m venv "$VENV_DIR"
    fi
else
    echo ""
    echo "📍 创建新虚拟环境..."
    python3 -m venv "$VENV_DIR"
fi

# 3. 激活虚拟环境
echo ""
echo "📍 激活虚拟环境..."
source "$VENV_DIR/bin/activate"

# 4. 升级pip
echo ""
echo "📍 升级pip..."
pip install --upgrade pip

# 5. 安装依赖
echo ""
echo "📍 安装项目依赖..."
if [ -f "$PROJECT_DIR/requirements.txt" ]; then
    pip install -r "$PROJECT_DIR/requirements.txt"
else
    echo "❌ 未找到requirements.txt"
    exit 1
fi

# 6. 检查关键包
echo ""
echo "📍 验证关键包安装..."
python3 -c "
import sys
print(f'Python路径: {sys.executable}')

packages = [
    'fastapi',
    'sqlalchemy',
    'chromadb',
    'sentence_transformers',
    'openai'
]

missing = []
for pkg in packages:
    try:
        __import__(pkg.replace('-', '_'))
        print(f'✅ {pkg}')
    except ImportError:
        print(f'❌ {pkg}')
        missing.append(pkg)

if missing:
    print(f'\n缺少包: {missing}')
    sys.exit(1)
"

# 7. 创建必要的目录
echo ""
echo "📍 创建必要的目录..."
mkdir -p "$PROJECT_DIR/uploads"
mkdir -p "$PROJECT_DIR/knowledge_db"
mkdir -p "$PROJECT_DIR/chroma_db"
mkdir -p "$PROJECT_DIR/test_knowledge_db"

# 8. 检查.env文件
echo ""
echo "📍 检查环境变量配置..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        echo "   从.env.example创建.env..."
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        echo "   ⚠️ 请编辑.env文件，填入正确的配置"
    else
        echo "   ⚠️ 未找到.env文件，请创建并配置"
    fi
else
    echo "   ✅ .env文件已存在"
fi

# 9. 创建激活脚本
echo ""
echo "📍 创建便捷激活脚本..."
cat > "$PROJECT_DIR/activate.sh" << 'EOF'
#!/bin/bash
# 快速激活Muses虚拟环境
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/venv/bin/activate"
echo "✅ Muses虚拟环境已激活"
echo "   Python: $(which python3)"
echo "   使用 'deactivate' 退出虚拟环境"
EOF
chmod +x "$PROJECT_DIR/activate.sh"

echo ""
echo "========================================="
echo "✅ 环境配置完成！"
echo "========================================="
echo ""
echo "使用方式："
echo "1. 激活环境: source ./activate.sh"
echo "2. 启动后端: python3 start.py"
echo "3. 退出环境: deactivate"
echo ""
echo "提示："
echo "- 每次开发前运行: source ./activate.sh"
echo "- 更新依赖后运行: pip freeze > requirements.txt"
echo "- 环境问题时运行: ./setup_env.sh"
echo ""