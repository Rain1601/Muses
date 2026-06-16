import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db, userSettings } from '@/lib/db';
import { AuthenticationError, getCurrentUser } from '@/lib/auth/current-user';
import { serializeUser } from '@/lib/auth/serialize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    const body = {
      ...serializeUser(user),
      settings: settings
        ? {
            id: settings.id,
            userId: settings.userId,
            language: settings.language,
            theme: settings.theme,
            autoSave: settings.autoSave,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          }
        : null,
    };
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('profile failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
