from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from .database import create_tables
from .config import settings

# Import routers
from .api import auth, users, agents, articles, generate, upload, publish, process


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时创建数据库表
    create_tables()
    print("✅ Database tables created")
    yield


# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="智能文档生成平台后端API",
    version="2.0.0",
    debug=settings.debug,
    lifespan=lifespan
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 安全中间件
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", settings.host]
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/user", tags=["users"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(articles.router, prefix="/api/articles", tags=["articles"])
app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(publish.router, prefix="/api/publish", tags=["publish"])
app.include_router(process.router, prefix="/api/process", tags=["process"])


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": "2.0.0",
        "environment": settings.environment
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )