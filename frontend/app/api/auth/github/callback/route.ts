import { NextResponse, type NextRequest } from 'next/server';
import { createAccessToken } from '@/lib/auth/jwt';
import { buildAuthCallbackTarget } from '@/lib/auth/oauth';
import { upsertFromGitHub } from '@/lib/auth/user-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string | null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GitHub OAuth env not configured' }, { status: 500 });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const tokenJson = (await tokenRes.json()) as GitHubTokenResponse;
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new Error(`No access_token in GitHub response: ${JSON.stringify(tokenJson)}`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.status} ${await userRes.text()}`);
    }
    const ghUser = (await userRes.json()) as GitHubUser;

    const { user, isNewUser } = await upsertFromGitHub({
      githubId: String(ghUser.id),
      username: ghUser.login,
      email: ghUser.email,
      avatarUrl: ghUser.avatar_url,
      githubAccessToken: accessToken,
    });

    const jwt = await createAccessToken({ user_id: user.id });
    return NextResponse.redirect(buildAuthCallbackTarget(request, isNewUser, jwt));
  } catch (e) {
    console.error('GitHub callback failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'GitHub authentication failed' },
      { status: 500 },
    );
  }
}
