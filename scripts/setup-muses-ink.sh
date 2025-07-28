#!/bin/bash

# Muses.ink 域名 Cloudflare Tunnel 配置脚本
# 专门为 muses.ink 域名设计的安全配置

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

DOMAIN="muses.ink"
TUNNEL_NAME="muses-ink-tunnel"
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"

# 检查前置条件
check_prerequisites() {
    log "检查配置前置条件..."
    
    if ! command -v cloudflared &> /dev/null; then
        error "cloudflared 未安装"
        exit 1
    fi
    
    # 检查本地服务
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        error "前端服务 (端口 3004) 未运行"
        error "请先运行: ./scripts/mac-mini-deploy.sh start"
        exit 1
    fi
    
    if ! curl -f http://localhost:8080 >/dev/null 2>&1; then
        error "后端服务 (端口 8080) 未运行"
        error "请先运行: ./scripts/mac-mini-deploy.sh start"
        exit 1
    fi
    
    log "✅ 前置条件检查完成"
}

# Cloudflare 认证
authenticate() {
    log "检查 Cloudflare 认证状态..."
    
    if [[ ! -f "$CONFIG_DIR/cert.pem" ]]; then
        info "需要进行 Cloudflare 认证"
        info "请确保 muses.ink 已添加到你的 Cloudflare 账户"
        echo ""
        warn "重要："
        echo "1. 请先在 Cloudflare Dashboard 添加 muses.ink 域名"
        echo "2. 将阿里云的 DNS 服务器改为 Cloudflare 提供的 NS"
        echo "3. 等待 DNS 生效（通常 5-10 分钟）"
        echo ""
        
        read -p "确认已完成上述步骤后，按 Enter 继续认证..."
        
        cloudflared tunnel login
        
        if [[ ! -f "$CONFIG_DIR/cert.pem" ]]; then
            error "认证失败，请检查域名是否正确添加到 Cloudflare"
            exit 1
        fi
    fi
    
    log "✅ Cloudflare 认证完成"
}

# 创建或获取 Tunnel
setup_tunnel() {
    log "配置 Cloudflare Tunnel..."
    
    # 检查是否已存在 tunnel
    if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
        warn "Tunnel '$TUNNEL_NAME' 已存在"
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
        log "使用现有 Tunnel ID: $TUNNEL_ID"
    else
        info "创建新的 Tunnel: $TUNNEL_NAME"
        cloudflared tunnel create "$TUNNEL_NAME"
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
        log "✅ 新 Tunnel 创建完成，ID: $TUNNEL_ID"
    fi
}

# 生成安全配置文件
create_config() {
    log "生成安全配置文件..."
    
    # 备份现有配置
    if [[ -f "$CONFIG_FILE" ]]; then
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)"
        log "已备份现有配置文件"
    fi
    
    # 生成配置文件
    cat > "$CONFIG_FILE" << EOF
# Muses.ink Cloudflare Tunnel 安全配置
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

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
      # 安全头
      originServerName: localhost

  # WWW 重定向到主域名
  - hostname: www.muses.ink
    service: http://localhost:3004
    originRequest:
      httpHostHeader: localhost:3004
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveTimeout: 90s
      noTLSVerify: false

  # API 服务 - 独立子域名
  - hostname: api.muses.ink
    service: http://localhost:8080
    originRequest:
      httpHostHeader: localhost:8080
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveTimeout: 90s
      noTLSVerify: false

  # 管理后台（如果需要）
  - hostname: admin.muses.ink
    service: http://localhost:3004
    originRequest:
      httpHostHeader: localhost:3004
      path: /admin/*
      connectTimeout: 30s
      tlsTimeout: 10s
      noTLSVerify: false

  # 默认规则 - 拒绝所有其他请求
  - service: http_status:404

# 全局安全配置
loglevel: info
metrics: 127.0.0.1:8888
no-autoupdate: true
retries: 3
protocol: quic

# 连接优化
grace-period: 30s
EOF

    # 设置正确的文件权限
    chmod 600 "$CONFIG_FILE"
    if [[ -f "$CONFIG_DIR/$TUNNEL_ID.json" ]]; then
        chmod 600 "$CONFIG_DIR/$TUNNEL_ID.json"
    fi
    
    log "✅ 安全配置文件已生成"
}

# 配置 DNS 记录
setup_dns() {
    log "配置 DNS 记录..."
    
    info "为以下域名创建 CNAME 记录："
    echo "  - muses.ink (主站)"
    echo "  - www.muses.ink (WWW重定向)"  
    echo "  - api.muses.ink (API服务)"
    echo "  - admin.muses.ink (管理后台)"
    
    # 主域名
    if cloudflared tunnel route dns "$TUNNEL_NAME" "muses.ink"; then
        log "✅ 主域名 DNS 记录创建成功"
    else
        warn "主域名 DNS 记录可能已存在"
    fi
    
    # WWW 子域名
    if cloudflared tunnel route dns "$TUNNEL_NAME" "www.muses.ink"; then
        log "✅ WWW 域名 DNS 记录创建成功"
    else
        warn "WWW 域名 DNS 记录可能已存在"
    fi
    
    # API 子域名
    if cloudflared tunnel route dns "$TUNNEL_NAME" "api.muses.ink"; then
        log "✅ API 域名 DNS 记录创建成功"
    else
        warn "API 域名 DNS 记录可能已存在"
    fi
    
    # 管理后台
    if cloudflared tunnel route dns "$TUNNEL_NAME" "admin.muses.ink"; then
        log "✅ 管理域名 DNS 记录创建成功"
    else
        warn "管理域名 DNS 记录可能已存在"
    fi
}

# 创建启动脚本
create_startup_script() {
    log "创建 Tunnel 管理脚本..."
    
    cat > "$HOME/muses-tunnel.sh" << 'EOF'
#!/bin/bash

# Muses.ink Tunnel 管理脚本

set -e

TUNNEL_PID_FILE="$HOME/.cloudflared/muses-tunnel.pid"
TUNNEL_LOG_FILE="$HOME/.cloudflared/muses-tunnel.log"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

start_tunnel() {
    if [[ -f "$TUNNEL_PID_FILE" ]] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "✅ Tunnel 已在运行 (PID: $(cat "$TUNNEL_PID_FILE"))"
        return
    fi
    
    # 检查本地服务
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        echo "❌ 前端服务未运行，请先启动 Muses 应用"
        exit 1
    fi
    
    if ! curl -f http://localhost:8080 >/dev/null 2>&1; then
        echo "❌ 后端服务未运行，请先启动 Muses 应用"
        exit 1
    fi
    
    echo "🚀 启动 Muses.ink Tunnel..."
    nohup cloudflared tunnel --config "$CONFIG_FILE" run > "$TUNNEL_LOG_FILE" 2>&1 &
    echo $! > "$TUNNEL_PID_FILE"
    
    sleep 3
    if kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
        echo "✅ Tunnel 启动成功 (PID: $(cat "$TUNNEL_PID_FILE"))"
        echo ""
        echo "🌐 访问地址："
        echo "   主站: https://muses.ink"
        echo "   API:  https://api.muses.ink"
        echo "   管理: https://admin.muses.ink"
    else
        echo "❌ Tunnel 启动失败，请检查日志"
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
        echo "🌐 访问地址："
        echo "   主站: https://muses.ink"
        echo "   API:  https://api.muses.ink"
        echo "   管理: https://admin.muses.ink"
        return 0
    else
        echo "❌ Tunnel 未运行"
        return 1
    fi
}

show_logs() {
    if [[ -f "$TUNNEL_LOG_FILE" ]]; then
        tail -f "$TUNNEL_LOG_FILE"
    else
        echo "❌ 日志文件不存在"
    fi
}

case "${1:-start}" in
    "start")
        start_tunnel
        ;;
    "stop")
        stop_tunnel
        ;;
    "restart")
        stop_tunnel
        sleep 2
        start_tunnel
        ;;
    "status")
        status_tunnel
        ;;
    "logs")
        show_logs
        ;;
    *)
        echo "Muses.ink Tunnel 管理脚本"
        echo ""
        echo "用法: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "命令说明："
        echo "  start   - 启动 tunnel"
        echo "  stop    - 停止 tunnel"  
        echo "  restart - 重启 tunnel"
        echo "  status  - 检查状态"
        echo "  logs    - 查看日志"
        exit 1
        ;;
esac
EOF
    
    chmod +x "$HOME/muses-tunnel.sh"
    log "✅ 管理脚本已创建: $HOME/muses-tunnel.sh"
}

# 安全测试
security_test() {
    log "执行安全配置测试..."
    
    # 测试配置文件语法
    if cloudflared tunnel ingress validate "$CONFIG_FILE"; then
        log "✅ 配置文件语法正确"
    else
        error "❌ 配置文件语法错误"
        return 1
    fi
    
    # 检查文件权限
    if [[ "$(stat -f %Mp%Lp "$CONFIG_FILE")" == "600" ]]; then
        log "✅ 配置文件权限正确"
    else
        warn "⚠️  修正配置文件权限"
        chmod 600 "$CONFIG_FILE"
    fi
    
    log "✅ 安全配置测试完成"
}

# 主函数
main() {
    echo ""
    log "🎨 Muses.ink 域名 Cloudflare Tunnel 配置"
    log "安全公网访问配置向导"
    echo ""
    
    check_prerequisites
    authenticate
    setup_tunnel
    create_config
    setup_dns
    create_startup_script
    security_test
    
    echo ""
    log "🎉 Muses.ink Tunnel 配置完成！"
    echo ""
    info "下一步操作："
    echo "1. 等待 DNS 生效 (5-10 分钟)"
    echo "2. 启动 tunnel: $HOME/muses-tunnel.sh start"
    echo "3. 检查状态: $HOME/muses-tunnel.sh status"
    echo ""
    info "访问地址："
    echo "- 主站: https://muses.ink"
    echo "- API:  https://api.muses.ink"  
    echo "- 管理: https://admin.muses.ink"
    echo ""
    warn "安全提醒："
    echo "- 建议在 Cloudflare Dashboard 配置 WAF 规则"
    echo "- 设置访问速率限制"
    echo "- 启用 DDoS 保护"
    echo "- 定期检查访问日志"
    echo ""
    
    read -p "按 Enter 查看 Cloudflare 安全配置指南..."
    if [[ -f "docs/CLOUDFLARE_SECURITY.md" ]]; then
        echo "📖 请查看详细安全配置指南: docs/CLOUDFLARE_SECURITY.md"
    fi
}

# 运行主函数
main "$@"