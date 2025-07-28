#!/bin/bash

# Cloudflare Tunnel 安全部署脚本
# 用于 Muses 项目的安全公网访问

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

echo ""
log "🚀 Cloudflare Tunnel 安全部署向导"
echo ""

info "步骤概览："
echo "1. Cloudflare 账户认证"
echo "2. 创建 Tunnel"
echo "3. 配置域名和 DNS"
echo "4. 设置安全策略"
echo "5. 启动服务"
echo ""

read -p "按 Enter 开始配置..."

# 第一步：认证
log "步骤 1: Cloudflare 认证"
echo "即将打开浏览器进行 Cloudflare 认证..."
sleep 2
cloudflared tunnel login