import { NextResponse, type NextRequest } from 'next/server';
import { buildRedirectUri } from '@/lib/auth/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID is not configured' }, { status: 500 });
  }
  const redirectUri = buildRedirectUri(request, '/api/auth/github/callback');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'user:email,repo');
  url.searchParams.set('redirect_uri', redirectUri);
  return NextResponse.redirect(url.toString());
}
