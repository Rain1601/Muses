import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ALG = 'HS256';
const EXPIRES_IN_HOURS = Number(process.env.JWT_EXPIRE_HOURS ?? 168);

let cachedSecret: Uint8Array | null = null;
let cachedSecretMaterial: string | null = null;

function getSecret(): Uint8Array {
  const material = process.env.JWT_SECRET;
  if (!material) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  if (cachedSecret && cachedSecretMaterial === material) {
    return cachedSecret;
  }
  cachedSecret = new TextEncoder().encode(material);
  cachedSecretMaterial = material;
  return cachedSecret;
}

export interface AccessTokenPayload extends JWTPayload {
  user_id: string;
}

export async function createAccessToken(payload: Record<string, unknown>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXPIRES_IN_HOURS * 3600;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setExpirationTime(exp)
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
  if (typeof payload.user_id !== 'string') {
    throw new Error('Invalid token payload: user_id missing');
  }
  return payload as AccessTokenPayload;
}
