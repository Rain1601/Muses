import { NextResponse, type NextRequest } from 'next/server';
import { createAccessToken } from '@/lib/auth/jwt';
import { buildAuthCallbackTarget, buildRedirectUri } from '@/lib/auth/oauth';
import { upsertFromGoogle } from '@/lib/auth/user-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUser {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 501 });
  }

  try {
    const redirectUri = buildRedirectUri(request, '/api/auth/google/callback');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new Error(`No access_token in Google response: ${JSON.stringify(tokenJson)}`);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      throw new Error(`Google user fetch failed: ${userRes.status} ${await userRes.text()}`);
    }
    const gUser = (await userRes.json()) as GoogleUser;

    const { user, isNewUser } = await upsertFromGoogle({
      googleId: String(gUser.id),
      username: gUser.name ?? gUser.email ?? 'user',
      email: gUser.email,
      avatarUrl: gUser.picture,
    });

    const jwt = await createAccessToken({ user_id: user.id });
    return NextResponse.redirect(buildAuthCallbackTarget(request, isNewUser, jwt));
  } catch (e) {
    console.error('Google callback failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Google authentication failed' },
      { status: 500 },
    );
  }
}
