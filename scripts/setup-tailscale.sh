#!/bin/bash

# 设置 Tailscale VPN 用于安全访问

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 设置 Tailscale VPN${NC}"

# 检查并安装 Tailscale
if ! command -v tailscale &> /dev/null; then
    echo -e "${YELLOW}安装 Tailscale...${NC}"
    
    # 下载安装
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# 启动 Tailscale
echo -e "${GREEN}启动 Tailscale...${NC}"
sudo tailscale up

# 获取 Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)

echo -e "${GREEN}✅ Tailscale 设置完成${NC}"
echo -e "${BLUE}Tailscale IP: $TAILSCALE_IP${NC}"
echo -e "\n${YELLOW}重要步骤:${NC}"
echo -e "  1. 在 MacBook Pro 上也安装 Tailscale"
echo -e "  2. 使用相同账号登录"
echo -e "  3. 在 GitHub Secrets 中设置:"
echo -e "     DEPLOY_WEBHOOK_URL = http://$TAILSCALE_IP:9000/webhook"
echo -e "\n${GREEN}优势:${NC}"
echo -e "  ✅ 安全的点对点连接"
echo -e "  ✅ 无需公网 IP"
echo -e "  ✅ 穿透 NAT"
echo -e "  ✅ 自动重连"