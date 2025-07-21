from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # 应用配置
    app_name: str = "Muses Backend"
    environment: str = "development"
    debug: bool = True
    host: str = "localhost"
    port: int = 8080
    frontend_url: str = "http://localhost:3004"
    
    # 数据库配置
    database_url: str = "sqlite:///./muses.db"
    
    # GitHub OAuth配置
    github_client_id: str
    github_client_secret: str
    
    # JWT配置
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168  # 7天
    
    # 数据加密配置
    encryption_key: str
    encryption_salt: str = "muses_encryption_salt"
    
    # OpenAI配置
    openai_api_key: Optional[str] = None
    
    # 文件上传配置
    max_file_size: int = 10485760  # 10MB
    upload_dir: str = "./uploads"
    
    # 日志配置
    log_level: str = "debug"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # 忽略额外的环境变量


# 创建全局设置实例
settings = Settings()

# 确保上传目录存在
os.makedirs(settings.upload_dir, exist_ok=True)