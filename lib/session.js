// HMAC-signed session cookie, minted by /api/login and checked by proxy.js
// and the route handlers. Web Crypto only, so it runs on the edge and in node.
import { SESSION_COOKIE } from './model';

const DAYS = 30;

async function hmac(msg, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEq(a = '', b = '') {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signSession(secret) {
  const exp = Date.now() + DAYS * 86400 * 1000;
  return `${exp}.${await hmac(`cabinet.${exp}`, secret)}`;
}

export async function verifySession(value, secret) {
  if (!value || !secret) return false;
  const dot = value.indexOf('.');
  if (dot < 1) return false;
  const exp = value.slice(0, dot), sig = value.slice(dot + 1);
  if (Number(exp) < Date.now()) return false;
  return safeEq(sig, await hmac(`cabinet.${exp}`, secret));
}

function cookieValue(header, name) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// Route-handler auth: the assistant's bearer token, HTTP Basic, or the
// session cookie all count. The proxy already gates everything; this is the
// defense-in-depth copy for mutating routes.
export async function routeAuthed(req, { ingest = false } = {}) {
  const auth = req.headers.get('authorization') || '';
  if (ingest && process.env.INGEST_TOKEN && auth === `Bearer ${process.env.INGEST_TOKEN}`) return true;
  if (process.env.HUB_USERNAME && process.env.HUB_PASSWORD && auth.startsWith('Basic ')) {
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (safeEq(u || '', process.env.HUB_USERNAME) && safeEq(p || '', process.env.HUB_PASSWORD)) return true;
  }
  return verifySession(cookieValue(req.headers.get('cookie'), SESSION_COOKIE), process.env.HUB_PASSWORD);
}
