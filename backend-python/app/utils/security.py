from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend
from jose import JWTError, jwt
from datetime import datetime, timedelta
from ..config import settings
import secrets
import base64


def _get_encryption_key() -> bytes:
    """生成或获取加密密钥"""
    key = settings.encryption_key
    salt = settings.encryption_salt.encode()
    
    # 使用Scrypt KDF生成32字节密钥
    kdf = Scrypt(
        length=32,
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        backend=default_backend()
    )
    return kdf.derive(key.encode())


def encrypt(text: str) -> str:
    """加密文本"""
    try:
        key = _get_encryption_key()
        aesgcm = AESGCM(key)
        nonce = secrets.token_bytes(12)  # 12字节随机数
        
        ciphertext = aesgcm.encrypt(nonce, text.encode(), None)
        
        # 组合nonce和密文，用base64编码
        encrypted_data = nonce + ciphertext
        return base64.b64encode(encrypted_data).decode()
        
    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")


def decrypt(encrypted_data: str) -> str:
    """解密文本"""
    try:
        key = _get_encryption_key()
        aesgcm = AESGCM(key)
        
        # base64解码
        encrypted_bytes = base64.b64decode(encrypted_data.encode())
        
        # 分离nonce和密文
        nonce = encrypted_bytes[:12]
        ciphertext = encrypted_bytes[12:]
        
        # 解密
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode()
        
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")


def create_access_token(data: dict) -> str:
    """创建JWT访问令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expire_hours)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.jwt_secret, 
        algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def verify_token(token: str) -> dict:
    """验证JWT令牌"""
    try:
        payload = jwt.decode(
            token, 
            settings.jwt_secret, 
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        raise ValueError("Invalid token")