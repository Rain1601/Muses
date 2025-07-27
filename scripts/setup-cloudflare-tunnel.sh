#!/bin/bash

# 设置 Cloudflare Tunnel

set -e

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}☁️  配置 Cloudflare Tunnel${NC}"

# 1. 安装 cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}安装 cloudflared...${NC}"
    brew install cloudflared
fi

# 2. 登录 Cloudflare
echo -e "${GREEN}登录 Cloudflare...${NC}"
cloudflared tunnel login

# 3. 创建 tunnel
TUNNEL_NAME="muses-tunnel"
echo -e "${GREEN}创建 tunnel: $TUNNEL_NAME${NC}"
cloudflared tunnel create $TUNNEL_NAME

# 4. 创建配置文件
echo -e "${GREEN}创建配置文件...${NC}"
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: $HOME/.cloudflared/*.json

ingress:
  # 前端
  - hostname: muses.yourdomain.com
    service: http://localhost:3004
  
  # 后端 API
  - hostname: api.muses.yourdomain.com
    service: http://localhost:8080
  
  # 404 规则
  - service: http_status:404
EOF

# 5. 路由 DNS
echo -e "${YELLOW}请在 Cloudflare 控制台添加 CNAME 记录：${NC}"
echo "  muses.yourdomain.com -> <tunnel-id>.cfargotunnel.com"
echo "  api.muses.yourdomain.com -> <tunnel-id>.cfargotunnel.com"

# 6. 安装为服务
echo -e "${GREEN}安装 Cloudflare Tunnel 服务...${NC}"
sudo cloudflared service install

echo -e "${GREEN}✅ Cloudflare Tunnel 配置完成！${NC}"
echo -e "${BLUE}启动服务:${NC} sudo cloudflared service start"
echo -e "${BLUE}查看状态:${NC} sudo cloudflared service status"