#!/bin/bash

# 预配置 muses.ink Tunnel - 等待域名激活时使用
# 当域名激活后可以立即运行

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

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

CONFIG_DIR="$HOME/.cloudflared"
DOMAIN="muses.ink"

# 检查域名状态
check_domain_status() {
    log "检查域名激活状态..."
    
    if nslookup muses.ink | grep -q "cloudflare"; then
        log "✅ 域名已激活，DNS 指向 Cloudflare"
        return 0
    else
        warn "域名还未完全激活，但可以继续配置"
        info "预计激活时间：5分钟 - 24小时"
        return 1
    fi
}

# 检查服务状态
check_services() {
    log "检查本地服务状态..."
    
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        error "前端服务未运行，请先启动："
        echo "  cd frontend && npm start"
        exit 1
    fi
    
    if ! curl -f http://localhost:8080 >/dev/null 2>&1; then
        error "后端服务未运行，请先启动："
        echo "  ./scripts/mac-mini-deploy.sh start"
        exit 1
    fi
    
    log "✅ 本地服务运行正常"
}

# 准备配置目录
prepare_config() {
    log "准备配置目录..."
    
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    
    # 创建预配置文件模板
    cat > "$CONFIG_DIR/muses-config-template.yml" << EOF
# Muses.ink Cloudflare Tunnel 安全配置模板
# 域名激活后使用

tunnel: YOUR_TUNNEL_ID
credentials-file: $CONFIG_DIR/YOUR_TUNNEL_ID.json

# 入口规则 - 安全配置
ingress:
  # 主站 - 前端服务
  - hostname: muses.ink
    service: http://localhost:3004
    originRequest:
      httpHostHeader: localhost:3004
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveTimeout: 90s
      noTLSVerify: false

  # WWW 重定向
  - hostname: www.muses.ink
    service: http://localhost:3004
    originRequest:
      httpHostHeader: localhost:3004
      connectTimeout: 30s
      tlsTimeout: 10s
      noTLSVerify: false

  # API 服务
  - hostname: api.muses.ink
    service: http://localhost:8080
    originRequest:
      httpHostHeader: localhost:8080
      connectTimeout: 30s
      tlsTimeout: 10s
      noTLSVerify: false

  # 管理后台
  - hostname: admin.muses.ink
    service: http://localhost:3004
    originRequest:
      httpHostHeader: localhost:3004
      path: /admin/*
      connectTimeout: 30s
      tlsTimeout: 10s
      noTLSVerify: false

  # 默认拒绝
  - service: http_status:404

# 全局安全配置
loglevel: info
metrics: 127.0.0.1:8888
no-autoupdate: true
retries: 3
protocol: quic
grace-period: 30s
EOF
    
    log "✅ 配置模板已准备"
}

# 创建快速部署脚本
create_quick_deploy() {
    log "创建快速部署脚本..."
    
    cat > "$HOME/deploy-muses-tunnel.sh" << 'EOF'
#!/bin/bash

# Muses.ink Tunnel 快速部署脚本
# 域名激活后立即运行此脚本

set -e

DOMAIN="muses.ink"
TUNNEL_NAME="muses-ink-tunnel"
CONFIG_DIR="$HOME/.cloudflared"

echo "🚀 开始部署 Muses.ink Tunnel..."

# 检查认证
if [[ ! -f "$CONFIG_DIR/cert.pem" ]]; then
    echo "需要先进行 Cloudflare 认证..."
    cloudflared tunnel login
fi

# 创建 tunnel
echo "创建 tunnel..."
if ! cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
    cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

# 生成配置文件
sed "s/YOUR_TUNNEL_ID/$TUNNEL_ID/g" "$CONFIG_DIR/muses-config-template.yml" > "$CONFIG_DIR/config.yml"
chmod 600 "$CONFIG_DIR/config.yml"

# 配置 DNS
echo "配置 DNS 记录..."
cloudflared tunnel route dns "$TUNNEL_NAME" "muses.ink"
cloudflared tunnel route dns "$TUNNEL_NAME" "www.muses.ink"  
cloudflared tunnel route dns "$TUNNEL_NAME" "api.muses.ink"
cloudflared tunnel route dns "$TUNNEL_NAME" "admin.muses.ink"

echo "✅ 部署完成！"
echo ""
echo "启动 tunnel:"
echo "  cloudflared tunnel --config ~/.cloudflared/config.yml run"
echo ""
echo "或使用管理脚本:"
echo "  ~/muses-tunnel.sh start"
EOF
    
    chmod +x "$HOME/deploy-muses-tunnel.sh"
    log "✅ 快速部署脚本已创建: $HOME/deploy-muses-tunnel.sh"
}

# 创建管理脚本
create_management_script() {
    log "创建 Tunnel 管理脚本..."
    
    cat > "$HOME/muses-tunnel.sh" << 'EOF'
#!/bin/bash

# Muses.ink Tunnel 管理脚本

TUNNEL_PID_FILE="$HOME/.cloudflared/muses-tunnel.pid"
TUNNEL_LOG_FILE="$HOME/.cloudflared/muses-tunnel.log"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

start_tunnel() {
    if [[ -f "$TUNNEL_PID_FILE" ]] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "✅ Tunnel 已在运行 (PID: $(cat "$TUNNEL_PID_FILE"))"
        return
    fi
    
    echo "🚀 启动 Muses.ink Tunnel..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo "❌ 配置文件不存在，请先运行: ~/deploy-muses-tunnel.sh"
        exit 1
    fi
    
    nohup cloudflared tunnel --config "$CONFIG_FILE" run > "$TUNNEL_LOG_FILE" 2>&1 &
    echo $! > "$TUNNEL_PID_FILE"
    
    sleep 3
    if kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "✅ Tunnel 启动成功!"
        echo ""
        echo "🌐 访问地址："
        echo "   主站: https://muses.ink"
        echo "   API:  https://api.muses.ink"
        echo "   管理: https://admin.muses.ink"
    else
        echo "❌ Tunnel 启动失败"
        exit 1
    fi
}

stop_tunnel() {
    if [[ -f "$TUNNEL_PID_FILE" ]] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "🛑 停止 Tunnel..."
        kill "$(cat "$TUNNEL_PID_FILE")"
        rm -f "$TUNNEL_PID_FILE"
        echo "✅ Tunnel 已停止"
    else
        echo "❌ Tunnel 未运行"
    fi
}

status_tunnel() {
    if [[ -f "$TUNNEL_PID_FILE" ]] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "✅ Tunnel 正在运行 (PID: $(cat "$TUNNEL_PID_FILE"))"
        echo ""
        echo "🌐 可访问地址："
        echo "   https://muses.ink"
        echo "   https://api.muses.ink"
        return 0
    else
        echo "❌ Tunnel 未运行"
        return 1
    fi
}

case "${1:-start}" in
    "start") start_tunnel ;;
    "stop") stop_tunnel ;;
    "restart") stop_tunnel; sleep 2; start_tunnel ;;
    "status") status_tunnel ;;
    "logs") tail -f "$TUNNEL_LOG_FILE" ;;
    *) 
        echo "用法: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF
    
    chmod +x "$HOME/muses-tunnel.sh"
    log "✅ 管理脚本已创建: $HOME/muses-tunnel.sh"
}

# 检查域名激活状态的脚本
create_status_checker() {
    log "创建域名状态检查脚本..."
    
    cat > "$HOME/check-muses-status.sh" << 'EOF'
#!/bin/bash

# 检查 muses.ink 域名激活状态

echo "🔍 检查 muses.ink 域名状态..."
echo ""

# 检查 DNS 解析
echo "DNS 解析检查："
if nslookup muses.ink 2>/dev/null | grep -q "cloudflare"; then
    echo "✅ DNS 已指向 Cloudflare"
else
    echo "⏳ DNS 还未完全生效，继续等待..."
fi

echo ""

# 检查 HTTPS 访问
echo "HTTPS 访问检查："
if curl -I https://muses.ink 2>/dev/null | grep -q "HTTP"; then
    echo "✅ HTTPS 访问正常"
else
    echo "⏳ HTTPS 还未可用"
fi

echo ""

# 显示下一步
echo "📋 下一步操作："
echo "1. 等待域名完全激活"
echo "2. 运行: ~/deploy-muses-tunnel.sh"
echo "3. 启动: ~/muses-tunnel.sh start"
EOF
    
    chmod +x "$HOME/check-muses-status.sh"
    log "✅ 状态检查脚本已创建: $HOME/check-muses-status.sh"
}

# 主函数
main() {
    echo ""
    log "🎨 Muses.ink Tunnel 预配置"
    log "为域名激活做准备"
    echo ""
    
    check_services
    check_domain_status
    prepare_config
    create_quick_deploy
    create_management_script
    create_status_checker
    
    echo ""
    log "🎉 预配置完成！"
    echo ""
    info "现在可以："
    echo "1. 检查域名状态: ~/check-muses-status.sh"
    echo "2. 等待域名激活通知邮件"
    echo "3. 域名激活后运行: ~/deploy-muses-tunnel.sh"
    echo ""
    warn "预计激活时间: 15分钟 - 24小时"
    echo ""
}

main "$@"