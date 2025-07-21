#!/usr/bin/env python3
"""
Muses Python Backend 启动脚本
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
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