#!/bin/bash

# Mac Mini 部署环境设置脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
  __  __                       
 |  \/  |_   _ ___  ___  ___   
 | |\/| | | | / __|/ _ \/ __|  
 | |  | | |_| \__ \  __/\__ \  
 |_|  |_|\__,_|___/\___||___/  
                               
Mac Mini 部署环境设置
EOF
echo -e "${NC}"

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"
}

# 检查系统要求
check_requirements() {
    log "检查系统要求..."
    
    # 检查 macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        error "此脚本仅支持 macOS"
        exit 1
    fi
    
    # 检查 Homebrew
    if ! command -v brew &> /dev/null; then
        warn "Homebrew 未安装，正在安装..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log "安装 Node.js..."
        brew install node
    fi
    
    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        log "安装 Python..."
        brew install python@3.10
    fi
    
    # 检查 Git
    if ! command -v git &> /dev/null; then
        log "安装 Git..."
        brew install git
    fi
    
    log "✅ 系统要求检查完成"
}

# 设置项目
setup_project() {
    log "设置项目..."
    
    PROJECT_DIR="$HOME/Muses"
    
    # 如果项目目录不存在，克隆项目
    if [ ! -d "$PROJECT_DIR" ]; then
        log "克隆项目到 $PROJECT_DIR"
        echo -e "${YELLOW}请输入你的 GitHub 仓库 URL (例如: https://github.com/username/Muses.git):${NC}"
        read -r REPO_URL
        
        if [ -z "$REPO_URL" ]; then
            error "仓库 URL 不能为空"
            exit 1
        fi
        
        git clone "$REPO_URL" "$PROJECT_DIR"
    else
        log "项目目录已存在: $PROJECT_DIR"
        cd "$PROJECT_DIR"
        git pull origin main
    fi
    
    cd "$PROJECT_DIR"
    
    # 给脚本执行权限
    chmod +x scripts/*.sh
    
    log "✅ 项目设置完成"
}

# 安装依赖
install_dependencies() {
    log "安装项目依赖..."
    
    cd "$PROJECT_DIR"
    
    # 安装前端依赖
    log "安装前端依赖..."
    cd frontend
    npm install
    
    # 安装后端依赖
    log "安装后端依赖..."
    cd ../backend-python
    pip3 install -r requirements.txt
    
    cd ..
    log "✅ 依赖安装完成"
}

# 配置环境变量
setup_environment() {
    log "配置环境变量..."
    
    # 生成随机密钥
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    
    # 创建环境配置文件
    cat > "$HOME/.muses-env" << EOF
# Muses 部署环境配置
export WEBHOOK_PORT=9000
export WEBHOOK_SECRET="$WEBHOOK_SECRET"
export PROJECT_DIR="$PROJECT_DIR"
EOF
    
    # 添加到 shell 配置文件
    SHELL_RC="$HOME/.zshrc"
    if [ ! -f "$SHELL_RC" ]; then
        SHELL_RC="$HOME/.bash_profile"
    fi
    
    if ! grep -q "muses-env" "$SHELL_RC"; then
        echo "" >> "$SHELL_RC"
        echo "# Muses deployment environment" >> "$SHELL_RC"
        echo "source ~/.muses-env" >> "$SHELL_RC"
    fi
    
    # 加载环境变量
    source "$HOME/.muses-env"
    
    log "✅ 环境变量配置完成"
    log "🔑 Webhook Secret: $WEBHOOK_SECRET"
}

# 创建系统服务
create_service() {
    log "创建系统服务..."
    
    # 创建 LaunchAgent plist 文件
    PLIST_FILE="$HOME/Library/LaunchAgents/com.muses.webhook.plist"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.muses.webhook</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$PROJECT_DIR/scripts/simple-webhook.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>WEBHOOK_PORT</key>
        <string>9000</string>
        <key>WEBHOOK_SECRET</key>
        <string>$WEBHOOK_SECRET</string>
        <key>PROJECT_DIR</key>
        <string>$PROJECT_DIR</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>$HOME/muses-webhook.log</string>
    
    <key>StandardErrorPath</key>
    <string>$HOME/muses-webhook-error.log</string>
</dict>
</plist>
EOF
    
    # 加载服务
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    
    log "✅ 系统服务创建完成"
}

# 测试部署
test_deployment() {
    log "测试部署功能..."
    
    # 等待 webhook 服务启动
    sleep 3
    
    # 测试健康检查
    if curl -f http://localhost:9000/health >/dev/null 2>&1; then
        log "✅ Webhook 服务运行正常"
    else
        error "❌ Webhook 服务启动失败"
        return 1
    fi
    
    log "🧪 可以手动测试部署: curl -X POST http://localhost:9000/deploy"
}

# 显示配置信息
show_configuration() {
    echo -e "\n${GREEN}🎉 Mac Mini 部署环境设置完成！${NC}\n"
    
    echo -e "${BLUE}📋 配置信息:${NC}"
    echo -e "  📂 项目目录: $PROJECT_DIR"
    echo -e "  📡 Webhook 端口: 9000"
    echo -e "  🔑 Webhook Secret: $WEBHOOK_SECRET"
    echo -e "  📝 日志文件: $HOME/muses-webhook.log"
    
    echo -e "\n${BLUE}🔧 下一步操作:${NC}"
    echo -e "  1. 在 GitHub 仓库设置中配置 Secrets:"
    echo -e "     - DEPLOY_WEBHOOK_URL: http://你的Mac-Mini-IP:9000/webhook"
    echo -e "     - DEPLOY_WEBHOOK_SECRET: $WEBHOOK_SECRET"
    echo -e "  2. 推送代码到 main 分支测试自动部署"
    echo -e "  3. 查看日志: tail -f $HOME/muses-webhook.log"
    
    echo -e "\n${BLUE}📱 手动操作命令:${NC}"
    echo -e "  部署: curl -X POST http://localhost:9000/deploy"
    echo -e "  健康检查: curl http://localhost:9000/health"
    echo -e "  查看服务状态: launchctl list | grep muses"
    echo -e "  重启服务: launchctl unload ~/Library/LaunchAgents/com.muses.webhook.plist && launchctl load ~/Library/LaunchAgents/com.muses.webhook.plist"
}

# 主函数
main() {
    log "开始设置 Mac Mini 部署环境..."
    
    check_requirements
    setup_project
    install_dependencies
    setup_environment
    create_service
    test_deployment
    show_configuration
    
    log "🎉 设置完成！"
}

# 运行主函数
main "$@"