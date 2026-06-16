import type { NextRequest } from 'next/server';

export function getAppOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (env) return env.replace(/\/$/, '');
  return request.nextUrl.origin;
}

export function buildRedirectUri(request: NextRequest, path: string): string {
  return `${getAppOrigin(request)}${path}`;
}

export function buildAuthCallbackTarget(
  request: NextRequest,
  isNewUser: boolean,
  jwtToken: string,
): string {
  const origin = getAppOrigin(request);
  const path = isNewUser ? '/onboarding' : '/dashboard';
  return `${origin}${path}?token=${encodeURIComponent(jwtToken)}`;
}
