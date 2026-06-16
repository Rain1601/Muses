import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_BASE_URLS: Record<string, string> = {
  aihubmix: 'https://aihubmix.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

export async function POST(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider');
  const key = request.nextUrl.searchParams.get('key');
  if (!provider || !key) {
    return NextResponse.json({ valid: false, error: 'provider and key required' }, { status: 400 });
  }
  const baseUrl = PROVIDER_BASE_URLS[provider];
  if (!baseUrl) {
    return NextResponse.json({ valid: false, error: `Unknown provider: ${provider}` });
  }
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: `HTTP ${res.status}` });
    }
    return NextResponse.json({ valid: true });
  } catch (e) {
    return NextResponse.json({
      valid: false,
      error: e instanceof Error ? e.message : 'request failed',
    });
  }
}
