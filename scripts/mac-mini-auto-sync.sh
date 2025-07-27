#!/bin/bash

# Mac Mini 自动同步部署脚本
# 自动检测 GitHub 更新并部署

set -e

# ==================== 配置 ====================
PROJECT_DIR="$HOME/Muses"  # 项目目录
LOG_FILE="$HOME/muses-sync.log"
CHECK_INTERVAL=30  # 检查间隔（秒）

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ==================== 函数 ====================
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

# 检查服务健康状态
check_health() {
    local all_healthy=true
    
    # 检查前端
    if ! curl -f http://localhost:3004 >/dev/null 2>&1; then
        all_healthy=false
    fi
    
    # 检查后端
    if ! curl -f http://localhost:8080/health >/dev/null 2>&1; then
        all_healthy=false
    fi
    
    $all_healthy
}

# 重启服务
restart_services() {
    log "重启服务..."
    
    # 停止服务
    pkill -f "next.*3004" || true
    pkill -f "python.*8080" || true
    sleep 3
    
    # 启动后端
    cd "$PROJECT_DIR/backend-python"
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 > "$HOME/muses-backend.log" 2>&1 &
    
    # 启动前端
    cd "$PROJECT_DIR/frontend"
    nohup npm start > "$HOME/muses-frontend.log" 2>&1 &
    
    sleep 10
}

# 部署函数
deploy() {
    log "开始部署..."
    
    cd "$PROJECT_DIR"
    
    # 拉取最新代码
    git reset --hard
    git clean -fd
    git pull origin main
    
    # 检查是否有更新
    local has_updates=false
    
    # 检查前端依赖更新
    cd frontend
    if [ package-lock.json -nt node_modules ] || [ package.json -nt node_modules ]; then
        log "检测到前端依赖更新"
        npm ci
        has_updates=true
    fi
    
    # 构建前端
    if [ "$has_updates" = true ] || [ ! -d ".next" ]; then
        log "构建前端..."
        npm run build
    fi
    
    # 检查后端依赖更新
    cd ../backend-python
    if [ requirements.txt -nt .last_pip_install ] 2>/dev/null; then
        log "检测到后端依赖更新"
        pip install -r requirements.txt
        touch .last_pip_install
        has_updates=true
    fi
    
    cd ..
    
    # 如果有更新或服务不健康，重启服务
    if [ "$has_updates" = true ] || ! check_health; then
        restart_services
    fi
    
    log "部署完成"
}

# 主循环
main_loop() {
    log "🚀 启动 Muses 自动同步服务"
    log "📂 项目目录: $PROJECT_DIR"
    log "⏱️  检查间隔: ${CHECK_INTERVAL}秒"
    
    # 初始部署
    deploy
    
    # 记录当前 commit
    local last_commit=$(git -C "$PROJECT_DIR" rev-parse HEAD)
    
    while true; do
        sleep "$CHECK_INTERVAL"
        
        # 检查远程更新
        git -C "$PROJECT_DIR" fetch origin main >/dev/null 2>&1
        local remote_commit=$(git -C "$PROJECT_DIR" rev-parse origin/main)
        
        if [ "$last_commit" != "$remote_commit" ]; then
            log "🔄 检测到新提交: ${remote_commit:0:7}"
            
            # 发送 macOS 通知
            osascript -e "display notification \"开始部署新版本 ${remote_commit:0:7}\" with title \"🚀 Muses 更新\" sound name \"Glass\""
            
            # 执行部署
            if deploy; then
                last_commit="$remote_commit"
                osascript -e "display notification \"部署成功 ✅\" with title \"🚀 Muses\" sound name \"Glass\""
            else
                error "部署失败"
                osascript -e "display notification \"部署失败 ❌\" with title \"🚀 Muses\" sound name \"Basso\""
            fi
        fi
        
        # 定期健康检查
        if ! check_health; then
            log "⚠️  服务健康检查失败，尝试重启..."
            restart_services
        fi
    done
}

# ==================== 主程序 ====================
case "${1:-run}" in
    "run")
        main_loop
        ;;
    "deploy")
        deploy
        ;;
    "restart")
        restart_services
        ;;
    "status")
        if check_health; then
            echo "✅ 服务运行正常"
        else
            echo "❌ 服务异常"
            exit 1
        fi
        ;;
    *)
        echo "用法: $0 {run|deploy|restart|status}"
        exit 1
        ;;
esac