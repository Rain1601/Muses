import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

// 确保加密密钥正确配置
function getEncryptionKey(): string {
  let key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('⚠️  ENCRYPTION_KEY not set, generating random key (data will be lost on restart)');
    key = crypto.randomBytes(32).toString('hex');
  }
  
  // 确保密钥长度正确
  if (key.length < 32) {
    key = key.padEnd(32, '0');
  }
  
  return key;
}

const secretKey = getEncryptionKey();
const salt = process.env.ENCRYPTION_SALT || 'muses-salt';

export function encrypt(text: string): string {
  const key = crypto.scryptSync(secretKey, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  try {
    // 检查数据格式
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data format');
    }
    
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Encrypted data format is invalid (expected 3 parts)');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = crypto.scryptSync(secretKey, salt, 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data. This might be due to incorrect encryption key or corrupted data.');
  }
}