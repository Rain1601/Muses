import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, users, type User } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export class AuthenticationError extends Error {
  constructor(message = 'Invalid authentication credentials') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

function extractBearerToken(request: NextRequest): string {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) throw new AuthenticationError('Missing Authorization header');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthenticationError('Authorization header is not a Bearer token');
  return match[1].trim();
}

export async function getCurrentUser(request: NextRequest): Promise<User> {
  const token = extractBearerToken(request);
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AuthenticationError();
  }
  const [user] = await db.select().from(users).where(eq(users.id, payload.user_id)).limit(1);
  if (!user) throw new AuthenticationError();
  return user;
}
