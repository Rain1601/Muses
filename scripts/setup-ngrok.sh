#!/bin/bash

# 设置 ngrok 用于公网访问

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌐 设置 ngrok 公网访问${NC}"

# 检查并安装 ngrok
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}安装 ngrok...${NC}"
    brew install ngrok
fi

# 检查 ngrok 认证
if ! ngrok config check &> /dev/null; then
    echo -e "${YELLOW}请先注册 ngrok 账号: https://dashboard.ngrok.com/signup${NC}"
    echo -e "${YELLOW}获取 authtoken 后运行: ngrok config add-authtoken YOUR_AUTH_TOKEN${NC}"
    exit 1
fi

# 创建 ngrok 配置文件
cat > ~/.ngrok2/muses.yml << EOF
version: "2"
tunnels:
  muses-webhook:
    proto: http
    addr: 9000
    inspect: false
    bind_tls: true
EOF

echo -e "${GREEN}✅ ngrok 配置完成${NC}"
echo -e "${BLUE}启动 ngrok:${NC}"
echo -e "  ngrok start muses-webhook"
echo -e "\n${YELLOW}注意：ngrok 会生成一个公网 URL，例如:${NC}"
echo -e "  https://abc123.ngrok.io"
echo -e "\n${BLUE}在 GitHub Secrets 中设置:${NC}"
echo -e "  DEPLOY_WEBHOOK_URL = https://你的域名.ngrok.io/webhook"