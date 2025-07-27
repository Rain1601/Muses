#!/bin/bash

# Mac Mini 一键安装脚本

set -e

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
  __  __                       
 |  \/  |_   _ ___  ___  ___   
 | |\/| | | | / __|/ _ \/ __|  
 | |  | | |_| \__ \  __/\__ \  
 |_|  |_|\__,_|___/\___||___/  
                               
Mac Mini 部署环境安装
EOF
echo -e "${NC}"

PROJECT_DIR="$PWD"

# 1. 创建 LaunchAgent 配置
echo -e "${GREEN}创建系统服务...${NC}"

# 确保 LaunchAgents 目录存在
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs"

cat > "$HOME/Library/LaunchAgents/com.muses.autosync.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.muses.autosync</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${PROJECT_DIR}/scripts/mac-mini-auto-sync.sh</string>
        <string>run</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/muses-sync.log</string>
    
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/muses-sync-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
</dict>
</plist>
EOF

# 2. 设置脚本权限
chmod +x "$PROJECT_DIR/scripts/mac-mini-auto-sync.sh"

# 3. 加载服务
echo -e "${GREEN}启动自动同步服务...${NC}"
launchctl bootout gui/$(id -u) "$HOME/Library/LaunchAgents/com.muses.autosync.plist" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/com.muses.autosync.plist"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 服务安装完成！${NC}"
else
    echo -e "${RED}⚠️  服务安装遇到问题，请手动启动：${NC}"
fi

echo ""
echo -e "${BLUE}管理命令：${NC}"
echo -e "${BLUE}查看日志:${NC} tail -f ~/Library/Logs/muses-sync.log"
echo -e "${BLUE}查看状态:${NC} launchctl list | grep muses"
echo -e "${BLUE}停止服务:${NC} launchctl bootout gui/\$(id -u) ~/Library/LaunchAgents/com.muses.autosync.plist"
echo -e "${BLUE}启动服务:${NC} launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.muses.autosync.plist"