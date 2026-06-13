from fastapi import HTTPException, status


class MusesException(Exception):
    """基础异常类"""
    pass


class AuthenticationError(MusesException):
    """认证错误"""
    pass


class AuthorizationError(MusesException):
    """授权错误"""
    pass


class ValidationError(MusesException):
    """验证错误"""
    pass


class NotFoundError(MusesException):
    """资源未找到错误"""
    pass


class OpenAIKeyError(MusesException):
    """OpenAI API Key错误"""
    pass


# HTTP异常
class HTTPAuthenticationError(HTTPException):
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class HTTPAuthorizationError(HTTPException):
    def __init__(self, detail: str = "Not enough permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class HTTPNotFoundError(HTTPException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class HTTPValidationError(HTTPException):
    def __init__(self, detail: str = "Validation error"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class HTTPOpenAIKeyError(HTTPException):
    def __init__(self, detail: str = "请先配置OpenAI API Key"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            headers={"code": "OPENAI_KEY_MISSING"},
        )