import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifySession } from './lib/session';
import { SESSION_COOKIE } from './lib/model';

function same(a = '', b = '') {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function proxy(req) {
  // Dev-only bypass for local visual testing. Never set on Vercel.
  if (process.env.CABINET_OPEN) return NextResponse.next();
  const path = req.nextUrl.pathname;
  // The login page and its POST must be reachable signed-out.
  if (path === '/login' || path === '/api/login') return secure(NextResponse.next());

  const auth = req.headers.get('authorization') || '';
  if (process.env.INGEST_TOKEN && ['/api/items', '/api/admin/seed', '/api/admin/seed/app/api/admin/seed'].includes(path) && req.method === 'POST' && same(auth, `Bearer ${process.env.INGEST_TOKEN}`)) return NextResponse.next();

  if (process.env.HUB_USERNAME && process.env.HUB_PASSWORD && auth.startsWith('Basic ')) {
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (same(u, process.env.HUB_USERNAME || '') && same(p, process.env.HUB_PASSWORD || '')) return secure(NextResponse.next());
  }

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.HUB_PASSWORD)) return secure(NextResponse.next());

  // Page requests without credentials go to the login form; clients that
  // attempted Basic (or API callers) still get the 401 challenge.
  const accept = req.headers.get('accept') || '';
  if (!path.startsWith('/api') && !auth && accept.includes('text/html'))
    return NextResponse.redirect(new URL('/login', req.url));
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Cabinet", charset="UTF-8"', 'Cache-Control': 'no-store' } });
}

function secure(r) {
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('X-Frame-Options', 'DENY');
  r.headers.set('Referrer-Policy', 'no-referrer');
  r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return r;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
