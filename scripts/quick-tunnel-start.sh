#!/bin/bash

# 快速启动 Cloudflare Tunnel - 免费版本
# 使用 trycloudflare.com 免费域名

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
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# 检查服务状态
check_services() {
    log "检查本地服务状态..."
    
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        error "前端服务未运行，请先启动 Muses 应用"
        echo "运行: cd frontend && npm start"
        exit 1
    fi
    
    if ! curl -f http://localhost:8080 >/dev/null 2>&1; then
        error "后端服务未运行，请先启动 Muses 应用"
        echo "运行: cd backend-python && python -m uvicorn app.main:app --host 0.0.0.0 --port 8080"
        exit 1
    fi
    
    log "✅ 本地服务状态正常"
}

# 启动免费 tunnel
start_free_tunnel() {
    log "启动免费 Cloudflare Tunnel..."
    info "这将为你的应用生成免费的公网访问地址"
    
    echo ""
    warn "重要提醒："
    echo "- 免费域名是临时的，重启后会变化"
    echo "- 仅用于测试和演示"
    echo "- 生产环境请使用自定义域名"
    echo ""
    
    read -p "按 Enter 继续..."
    
    # 创建临时配置
    mkdir -p ~/.cloudflared
    
    cat > ~/.cloudflared/quick-config.yml << EOF
# 临时配置 - 免费 tunnel
ingress:
  # 前端服务
  - hostname: 
    service: http://localhost:3004
  # API 服务 - 路径路由
  - hostname: 
    path: /api/*
    service: http://localhost:8080
  # 默认规则
  - service: http_status:404

# 基础配置
loglevel: info
no-autoupdate: true
EOF
    
    log "正在启动 tunnel，将显示公网访问地址..."
    echo ""
    
    # 启动免费 tunnel
    cloudflared tunnel --config ~/.cloudflared/quick-config.yml --url http://localhost:3004
}

# 主函数
main() {
    echo ""
    log "🚀 Cloudflare Tunnel 快速启动"
    log "免费公网访问 - 无需域名"
    echo ""
    
    check_services
    start_free_tunnel
}

case "${1:-start}" in
    "start")
        main
        ;;
    "help")
        echo "Cloudflare Tunnel 快速启动工具"
        echo ""
        echo "用法:"
        echo "  $0 start    # 启动免费 tunnel"
        echo "  $0 help     # 显示帮助"
        echo ""
        echo "注意:"
        echo "- 需要先启动 Muses 前端和后端服务"
        echo "- 免费域名每次重启都会变化"
        echo "- 适合测试和演示使用"
        ;;
    *)
        echo "用法: $0 {start|help}"
        exit 1
        ;;
esac