import { NextResponse, type NextRequest } from 'next/server';
import { AuthenticationError, getCurrentUser } from '@/lib/auth/current-user';
import { serializeUser } from '@/lib/auth/serialize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('verify failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
