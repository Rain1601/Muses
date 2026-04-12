from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from .database import create_tables, run_migrations
from .config import settings

# Import routers
from .api import auth, users, agents, articles, generate, upload, publish, process, proxy, image_upload, sync, import_files, knowledge, muses_config, chat_history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时创建数据库表
    create_tables()
    run_migrations()
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

# CORS中间件 — 支持逗号分隔的多个 origin
_origins = [o.strip() for o in settings.frontend_url.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 安全中间件
_trusted = ["localhost", "127.0.0.1", settings.host, "*.run.app"]
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_trusted,
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/user", tags=["users"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
from .api import agents_actions
app.include_router(agents_actions.router, prefix="/api/agents", tags=["agent-actions"])
app.include_router(articles.router, prefix="/api/articles", tags=["articles"])
app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(publish.router, prefix="/api/publish", tags=["publish"])
app.include_router(process.router, prefix="/api/process", tags=["process"])
app.include_router(proxy.router, prefix="/api", tags=["proxy"])
app.include_router(image_upload.router, prefix="/api", tags=["image-upload"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(import_files.router, prefix="/api/import", tags=["import"])
app.include_router(knowledge.router, tags=["knowledge"])  # prefix已在router中定义
app.include_router(muses_config.router, prefix="/api", tags=["muses-config"])
app.include_router(chat_history.router, prefix="/api/chat-history", tags=["chat-history"])

# Studio: 条件注册（依赖本地文件系统，生产环境可关闭）
if settings.enable_studio:
    from .api import studio
    app.include_router(studio.router, prefix="/api/studio", tags=["studio"])


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