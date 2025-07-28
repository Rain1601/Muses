#!/bin/bash

# Muses Mac Mini 自动部署脚本
# 专为 Mac Mini 环境优化

set -e  # 遇到错误立即退出

# ==================== 配置区域 ====================
# 自动检测项目路径
PROJECT_DIR="$PWD"

BACKUP_DIR="$HOME/Muses-backups"
LOG_FILE="$HOME/muses-deploy.log"
WEBHOOK_PORT=9000

# 进程管理
FRONTEND_PID_FILE="$HOME/.muses-frontend.pid"
BACKEND_PID_FILE="$HOME/.muses-backend.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ==================== 工具函数 ====================

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# 发送通知
send_notification() {
    local message="$1"
    local status="$2"
    
    # macOS 通知
    osascript -e "display notification \"$message\" with title \"🚀 Muses 部署\" subtitle \"$status\" sound name \"Glass\""
}

# 停止服务
stop_services() {
    log "停止现有服务..."
    
    # 停止前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            log "停止前端服务 (PID: $frontend_pid)"
            kill "$frontend_pid" || true
            sleep 2
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # 停止后端
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$backend_pid" 2>/dev/null; then
            log "停止后端服务 (PID: $backend_pid)"
            kill "$backend_pid" || true
            sleep 2
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # 强制停止残留进程
    pkill -f "next.*3004" || true
    pkill -f "python.*8080" || true
    
    sleep 3
}

# 启动服务
start_services() {
    log "启动服务..."
    
    cd "$PROJECT_DIR"
    
    # 启动后端
    log "启动后端服务..."
    cd backend-python
    nohup python -m uvicorn main:app --host 0.0.0.0 --port 8080 > "$HOME/muses-backend.log" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    log "后端服务已启动 (PID: $(cat $BACKEND_PID_FILE))"
    
    # 启动前端
    cd ../frontend
    log "启动前端服务..."
    nohup npm start > "$HOME/muses-frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    log "前端服务已启动 (PID: $(cat $FRONTEND_PID_FILE))"
    
    cd ..
}

# 健康检查
check_health() {
    log "执行健康检查..."
    
    # 等待服务启动
    sleep 15
    
    # 检查后端
    local backend_attempts=0
    while [ $backend_attempts -lt 6 ]; do
        if curl -f http://localhost:8080/ >/dev/null 2>&1; then
            log "✅ 后端服务健康检查通过"
            break
        fi
        backend_attempts=$((backend_attempts + 1))
        log "等待后端服务启动... ($backend_attempts/6)"
        sleep 5
    done
    
    if [ $backend_attempts -eq 6 ]; then
        error "❌ 后端服务健康检查失败"
        return 1
    fi
    
    # 检查前端
    local frontend_attempts=0
    while [ $frontend_attempts -lt 6 ]; do
        if curl -f http://localhost:3004 >/dev/null 2>&1; then
            log "✅ 前端服务健康检查通过"
            break
        fi
        frontend_attempts=$((frontend_attempts + 1))
        log "等待前端服务启动... ($frontend_attempts/6)"
        sleep 5
    done
    
    if [ $frontend_attempts -eq 6 ]; then
        error "❌ 前端服务健康检查失败"
        return 1
    fi
    
    log "🎉 所有服务健康检查通过"
    return 0
}

# 备份当前版本
backup_current() {
    log "备份当前版本..."
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ -d "$PROJECT_DIR" ]; then
        cp -r "$PROJECT_DIR" "$backup_path"
        echo "$backup_name" > "$BACKUP_DIR/latest_backup"
        log "✅ 备份完成: $backup_name"
    else
        warn "项目目录不存在，跳过备份"
    fi
}

# 回滚
rollback() {
    error "🔄 开始回滚..."
    
    if [ ! -f "$BACKUP_DIR/latest_backup" ]; then
        error "❌ 未找到备份，无法回滚"
        send_notification "回滚失败，未找到备份" "ERROR"
        return 1
    fi
    
    local backup_name=$(cat "$BACKUP_DIR/latest_backup")
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        error "❌ 备份目录不存在: $backup_path"
        send_notification "回滚失败，备份目录不存在" "ERROR"
        return 1
    fi
    
    log "回滚到: $backup_name"
    
    # 停止服务
    stop_services
    
    # 恢复备份
    rm -rf "$PROJECT_DIR"
    cp -r "$backup_path" "$PROJECT_DIR"
    
    # 重新安装依赖和启动
    cd "$PROJECT_DIR/frontend"
    npm ci --production
    npm run build
    
    cd ../backend-python
    pip3 install -r requirements.txt
    
    # 启动服务
    start_services
    
    if check_health; then
        log "✅ 回滚成功"
        send_notification "回滚成功: $backup_name" "SUCCESS"
        return 0
    else
        error "❌ 回滚后服务启动失败"
        send_notification "回滚失败，服务无法启动" "ERROR"
        return 1
    fi
}

# 主部署函数
deploy() {
    log "==================== 开始部署 ===================="
    
    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        error "项目目录不存在: $PROJECT_DIR"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # 获取当前状态
    local current_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    log "当前 commit: $current_commit"
    
    # 备份当前版本
    backup_current
    
    # 拉取最新代码
    log "拉取最新代码..."
    if ! git fetch origin main; then
        error "拉取代码失败"
        rollback
        return 1
    fi
    
    if ! git reset --hard origin/main; then
        error "重置到最新代码失败"
        rollback
        return 1
    fi
    
    local new_commit=$(git rev-parse HEAD)
    log "新的 commit: $new_commit"
    
    # 停止现有服务
    stop_services
    
    # 安装后端依赖
    log "安装后端依赖..."
    cd backend-python
    if ! pip3 install -r requirements.txt; then
        error "后端依赖安装失败"
        rollback
        return 1
    fi
    
    # 安装前端依赖
    log "安装前端依赖..."
    cd ../frontend
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
    
    # 启动服务
    start_services
    
    # 健康检查
    if check_health; then
        log "🎉 部署成功！"
        send_notification "部署成功: $(git rev-parse --short HEAD)" "SUCCESS"
        return 0
    else
        error "❌ 健康检查失败，开始回滚"
        rollback
        return 1
    fi
}

# ==================== 主函数 ====================

main() {
    case "${1:-deploy}" in
        "deploy")
            deploy
            ;;
        "rollback")
            rollback
            ;;
        "stop")
            stop_services
            ;;
        "start")
            start_services
            ;;
        "status")
            check_health
            ;;
        *)
            echo "用法: $0 {deploy|rollback|stop|start|status}"
            exit 1
            ;;
    esac
}

# 创建必要目录
mkdir -p "$BACKUP_DIR"

# 运行主函数
main "$@"