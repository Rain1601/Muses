import { NextResponse, type NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8080';

/**
 * 增量迁移开关: 仅当 USE_NEW_<MODULE>=1 时让 Next.js TS 路由处理对应前缀,
 * 否则强制 rewrite 到 Cloud Run / 本地 FastAPI。
 *
 * 没列出来的前缀 (/api/agents, /api/articles, ...) 不在 matcher 范围内,
 * 走 next.config.js 里的兜底 rewrite。
 */
const MIGRATED_MODULES: Array<{ prefix: string; flag: string }> = [
  { prefix: '/api/auth', flag: 'USE_NEW_AUTH' },
  { prefix: '/api/user', flag: 'USE_NEW_USER' },
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  for (const { prefix, flag } of MIGRATED_MODULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (process.env[flag] === '1') return NextResponse.next();
      const target = new URL(`${path}${request.nextUrl.search}`, BACKEND_URL);
      return NextResponse.rewrite(target);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Only intercept the modules we have toggles for; everything else flows
  // through the next.config.js /api/:path* rewrite (still pointing at Cloud Run).
  matcher: ['/api/auth/:path*', '/api/user/:path*'],
};
