import { NextResponse, type NextRequest } from 'next/server';
import { AuthenticationError, getCurrentUser } from '@/lib/auth/current-user';
import { decrypt } from '@/lib/crypto';
import type { User } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY_TYPE_TO_FIELD: Record<string, keyof User> = {
  aihubmix: 'aihubmixKey',
  openrouter: 'openrouterKey',
  bailian: 'bailianKey',
  openai: 'openaiKey',
  claude: 'claudeKey',
  gemini: 'geminiKey',
  github: 'githubToken',
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body = (await request.json()) as { keyType?: string };
    const keyType = body.keyType;
    if (!keyType) {
      return NextResponse.json({ error: 'keyType required' }, { status: 400 });
    }
    const field = KEY_TYPE_TO_FIELD[keyType];
    if (!field) {
      return NextResponse.json({ error: `Unknown keyType: ${keyType}` }, { status: 400 });
    }
    const encrypted = user[field] as string | null;
    if (!encrypted) {
      return NextResponse.json({ error: `No ${keyType} key found for user` }, { status: 400 });
    }
    return NextResponse.json({ key: decrypt(encrypted) });
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('get-api-key failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
