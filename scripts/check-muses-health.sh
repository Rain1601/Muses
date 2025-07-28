#!/bin/bash

# Muses 服务健康检查脚本
# 检查并自动重启失效的服务

LOG_FILE="$HOME/muses-health.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_and_restart_service() {
    local service_name="$1"
    local check_command="$2"
    local restart_command="$3"
    
    if eval "$check_command" > /dev/null 2>&1; then
        log_message "✅ $service_name 正常运行"
        return 0
    else
        log_message "❌ $service_name 服务异常，正在重启..."
        eval "$restart_command"
        sleep 3
        if eval "$check_command" > /dev/null 2>&1; then
            log_message "✅ $service_name 重启成功"
        else
            log_message "❌ $service_name 重启失败"
        fi
    fi
}

log_message "🔍 开始健康检查..."

# 检查后端服务
check_and_restart_service "后端服务" \
    "curl -f http://localhost:8080/" \
    "cd /Users/xiaogugu/PycharmProjects/Muses/backend-python && source venv_deploy/bin/activate && pkill -f uvicorn; nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 > ~/muses-backend.log 2>&1 & deactivate"

# 检查前端服务
check_and_restart_service "前端服务" \
    "curl -f http://localhost:3004/" \
    "cd /Users/xiaogugu/PycharmProjects/Muses/frontend && pkill -f 'next start'; nohup npm start > ~/muses-frontend.log 2>&1 &"

# 检查 Cloudflare Tunnel
check_and_restart_service "Cloudflare Tunnel" \
    "curl -f https://muses.ink/" \
    "~/muses-tunnel.sh restart"

log_message "✅ 健康检查完成"