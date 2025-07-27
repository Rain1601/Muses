#!/bin/bash

# 定时检查并自动部署（无需公网 IP）

set -e

# 配置
PROJECT_DIR="$HOME/Muses"
LOG_FILE="$HOME/muses-auto-deploy.log"
CHECK_INTERVAL=60  # 检查间隔（秒）

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

# 检查更新并部署
check_and_deploy() {
    cd "$PROJECT_DIR"
    
    # 获取当前 commit
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    # 拉取最新信息
    git fetch origin main >/dev/null 2>&1
    
    # 获取远程 commit
    REMOTE_COMMIT=$(git rev-parse origin/main)
    
    # 比较 commit
    if [ "$CURRENT_COMMIT" != "$REMOTE_COMMIT" ]; then
        log "🔄 检测到新的提交，开始部署..."
        log "当前: $CURRENT_COMMIT"
        log "远程: $REMOTE_COMMIT"
        
        # 执行部署
        "$PROJECT_DIR/scripts/mac-mini-deploy.sh" deploy
    fi
}

# 主循环
main() {
    log "🚀 启动自动部署监控..."
    log "📂 项目目录: $PROJECT_DIR"
    log "⏱️  检查间隔: ${CHECK_INTERVAL}秒"
    
    while true; do
        check_and_deploy
        sleep "$CHECK_INTERVAL"
    done
}

# 创建 LaunchAgent 配置
create_service() {
    cat > "$HOME/Library/LaunchAgents/com.muses.autopull.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.muses.autopull</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$PROJECT_DIR/scripts/auto-pull-deploy.sh</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>$HOME/muses-autopull.log</string>
    
    <key>StandardErrorPath</key>
    <string>$HOME/muses-autopull-error.log</string>
</dict>
</plist>
EOF

    echo -e "${GREEN}✅ 服务配置已创建${NC}"
    echo -e "${BLUE}启动服务:${NC}"
    echo "  launchctl load ~/Library/LaunchAgents/com.muses.autopull.plist"
}

# 判断是否需要创建服务
if [ "$1" == "install" ]; then
    create_service
else
    main
fi