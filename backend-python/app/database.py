from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# 创建数据库引擎
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    echo=settings.debug  # 开发环境显示SQL日志
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()


# 依赖注入：获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 创建所有表
def create_tables():
    Base.metadata.create_all(bind=engine)