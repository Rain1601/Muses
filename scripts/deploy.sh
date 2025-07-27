#!/bin/bash

# Muses 自动部署脚本
# 用于 Mac Mini 自动检测和部署

set -e  # 遇到错误立即退出

# 配置
PROJECT_DIR="/path/to/Muses"  # 修改为实际路径
BACKUP_DIR="/path/to/backup"  # 备份目录
LOG_FILE="/var/log/muses-deploy.log"
NOTIFICATION_WEBHOOK=""  # 可选：Slack/Discord webhook

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

# 发送通知
send_notification() {
    local message="$1"
    local status="$2"
    
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Muses 部署通知: $message (状态: $status)\"}" \
            $NOTIFICATION_WEBHOOK
    fi
    
    # macOS 本地通知
    osascript -e "display notification \"$message\" with title \"Muses 部署\" subtitle \"$status\""
}

# 备份当前版本
backup_current() {
    log "备份当前版本..."
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    cp -r "$PROJECT_DIR" "$BACKUP_DIR/$backup_name"
    echo "$backup_name" > "$BACKUP_DIR/latest_backup"
    log "备份完成: $backup_name"
}

# 回滚到上一个版本
rollback() {
    error "部署失败，开始回滚..."
    
    if [ -f "$BACKUP_DIR/latest_backup" ]; then
        local backup_name=$(cat "$BACKUP_DIR/latest_backup")
        log "回滚到备份版本: $backup_name"
        
        # 停止服务
        ./scripts/stop.sh || true
        
        # 恢复备份
        rm -rf "$PROJECT_DIR"
        cp -r "$BACKUP_DIR/$backup_name" "$PROJECT_DIR"
        
        # 重启服务
        cd "$PROJECT_DIR"
        ./scripts/start.sh
        
        log "回滚完成"
        send_notification "回滚到备份版本 $backup_name" "SUCCESS"
    else
        error "未找到备份文件，无法回滚"
        send_notification "回滚失败，未找到备份" "ERROR"
    fi
}

# 检查服务健康状态
check_health() {
    log "检查服务健康状态..."
    
    # 检查前端
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        error "前端服务健康检查失败"
        return 1
    fi
    
    # 检查后端
    if ! curl -f http://localhost:8080/health >/dev/null 2>&1; then
        error "后端服务健康检查失败"
        return 1
    fi
    
    log "服务健康检查通过"
    return 0
}

# 主部署函数
deploy() {
    log "=== 开始自动部署 ==="
    
    cd "$PROJECT_DIR"
    
    # 获取当前 commit
    local current_commit=$(git rev-parse HEAD)
    log "当前 commit: $current_commit"
    
    # 检查远程更新
    git fetch origin main
    local latest_commit=$(git rev-parse origin/main)
    log "远程最新 commit: $latest_commit"
    
    if [ "$current_commit" = "$latest_commit" ]; then
        log "没有新的更新，跳过部署"
        return 0
    fi
    
    log "发现新的提交，开始部署..."
    
    # 备份当前版本
    backup_current
    
    # 拉取最新代码
    if ! git pull origin main; then
        error "拉取代码失败"
        rollback
        return 1
    fi
    
    # 停止当前服务
    log "停止当前服务..."
    ./scripts/stop.sh || true
    
    # 安装依赖
    log "安装前端依赖..."
    cd frontend
    if ! npm ci; then
        error "前端依赖安装失败"
        rollback
        return 1
    fi
    
    # 构建前端
    log "构建前端..."
    if ! npm run build; then
        error "前端构建失败"
        rollback
        return 1
    fi
    
    cd ..
    
    # 安装后端依赖
    log "安装后端依赖..."
    cd backend-python
    if ! pip install -r requirements.txt; then
        error "后端依赖安装失败"
        rollback
        return 1
    fi
    
    cd ..
    
    # 启动服务
    log "启动服务..."
    if ! ./scripts/start.sh; then
        error "服务启动失败"
        rollback
        return 1
    fi
    
    # 等待服务启动
    sleep 10
    
    # 健康检查
    if ! check_health; then
        error "健康检查失败"
        rollback
        return 1
    fi
    
    log "=== 部署成功 ==="
    send_notification "部署成功，版本: $(git rev-parse --short HEAD)" "SUCCESS"
}

# 主函数
main() {
    # 检查是否在正确目录
    if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
        error "请在 Muses 项目根目录运行此脚本"
        exit 1
    fi
    
    # 创建必要目录
    mkdir -p "$BACKUP_DIR"
    
    # 执行部署
    if deploy; then
        log "部署流程完成"
        exit 0
    else
        error "部署失败"
        exit 1
    fi
}

# 运行
main "$@"