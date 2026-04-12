from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# 创建数据库引擎
_is_sqlite = "sqlite" in settings.database_url

_engine_kwargs = dict(
    echo=settings.debug,  # 开发环境显示SQL日志
)

if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pool settings
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )

engine = create_engine(settings.database_url, **_engine_kwargs)

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


def run_migrations():
    """添加新列到已有表（create_all 不处理 ALTER TABLE）"""
    insp = inspect(engine)
    if "User" not in insp.get_table_names():
        return

    existing = {c["name"] for c in insp.get_columns("User")}
    new_cols = ["aihubmixKey", "openrouterKey", "bailianKey"]
    with engine.begin() as conn:
        for col in new_cols:
            if col not in existing:
                conn.execute(text(f'ALTER TABLE "User" ADD COLUMN "{col}" VARCHAR'))
                print(f"Migration: added column {col} to User table")