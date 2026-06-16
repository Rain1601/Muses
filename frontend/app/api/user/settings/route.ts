import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db, users, userSettings } from '@/lib/db';
import { AuthenticationError, getCurrentUser } from '@/lib/auth/current-user';
import { encrypt } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY_FIELDS = [
  'aihubmixKey',
  'openrouterKey',
  'bailianKey',
  'openaiKey',
  'claudeKey',
  'geminiKey',
  'githubToken',
] as const;
type KeyField = (typeof KEY_FIELDS)[number];

interface SettingsBody {
  aihubmixKey?: string | null;
  openrouterKey?: string | null;
  bailianKey?: string | null;
  openaiKey?: string | null;
  claudeKey?: string | null;
  geminiKey?: string | null;
  githubToken?: string | null;
  defaultRepoUrl?: string | null;
  language?: string | null;
  theme?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body = (await request.json()) as SettingsBody;

    const userPatch: Partial<typeof users.$inferInsert> = {};
    if (body.defaultRepoUrl !== undefined) {
      userPatch.defaultRepoUrl = body.defaultRepoUrl;
    }
    for (const field of KEY_FIELDS) {
      const incoming = body[field as KeyField];
      if (incoming === undefined) continue;
      const trimmed = typeof incoming === 'string' ? incoming.trim() : '';
      userPatch[field] = trimmed ? encrypt(trimmed) : null;
    }
    if (Object.keys(userPatch).length > 0) {
      userPatch.updatedAt = new Date();
      await db.update(users).set(userPatch).where(eq(users.id, user.id));
    }

    if (body.language !== undefined || body.theme !== undefined) {
      const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);
      if (existing) {
        const patch: Partial<typeof userSettings.$inferInsert> = { updatedAt: new Date() };
        if (body.language !== undefined) patch.language = body.language ?? 'zh-CN';
        if (body.theme !== undefined) patch.theme = body.theme ?? 'light';
        await db.update(userSettings).set(patch).where(eq(userSettings.userId, user.id));
      } else {
        await db.insert(userSettings).values({
          userId: user.id,
          language: body.language ?? 'zh-CN',
          theme: body.theme ?? 'light',
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('settings update failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update settings' },
      { status: 400 },
    );
  }
}
