import crypto from 'node:crypto';
import { signSession } from '../../../lib/session';
import { SESSION_COOKIE } from '../../../lib/model';

function same(a = '', b = '') {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function POST(r) {
  const { username, password } = await r.json().catch(() => ({}));
  if (!same(username, process.env.HUB_USERNAME || '') || !same(password, process.env.HUB_PASSWORD || ''))
    return new Response('Unauthorized', { status: 401 });
  const value = await signSession(process.env.HUB_PASSWORD);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`,
    },
  });
}
