#!/usr/bin/env python3
"""
Muses Python Backend 启动脚本
"""

import uvicorn
import subprocess
import signal
import time
import psutil
from app.config import settings

def kill_existing_processes():
    """杀掉已经在运行的后端进程"""
    print("🔍 Checking for existing backend processes...")

    killed = False
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline and any('start.py' in str(cmd) or f':{settings.port}' in str(cmd) for cmd in cmdline):
                if proc.pid != psutil.Process().pid:  # 不杀掉当前进程
                    print(f"🔪 Killing existing process: PID {proc.info['pid']}")
                    proc.terminate()
                    killed = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

    if killed:
        print("⏳ Waiting for processes to terminate...")
        time.sleep(2)

if __name__ == "__main__":
    # 先杀掉已有进程
    kill_existing_processes()

    print(f"🚀 Starting {settings.app_name}")
    print(f"🌍 Environment: {settings.environment}")
    print(f"🔗 Frontend URL: {settings.frontend_url}")
    print(f"📍 Server: http://{settings.host}:{settings.port}")
    print()

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )