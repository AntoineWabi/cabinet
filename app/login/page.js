'use client';
import { useState } from 'react';

export default function Login() {
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(false);
    const f = new FormData(e.target);
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: f.get('username'), password: f.get('password') }),
    });
    if (r.ok) location.href = '/';
    else { setErr(true); setBusy(false); }
  }
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <b className="brand">CABINET<i>•</i></b>
        <input name="username" autoComplete="username" placeholder="Username" required />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" required />
        {err && <p className="login-err">That didn’t work. Try again.</p>}
        <button disabled={busy}>{busy ? 'Opening…' : 'Open the cabinet'}</button>
      </form>
    </main>
  );
}
