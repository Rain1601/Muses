from pydantic import BaseModel
from .user import User


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str


class AuthResponse(BaseModel):
    user: User


class SuccessResponse(BaseModel):
    success: bool = True