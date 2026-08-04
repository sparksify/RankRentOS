'use client';
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = '/';
    else setError('Wrong password');
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={submit} className="panel p-8 w-80 space-y-4">
        <h1 className="text-lg font-semibold text-brand">RankRentOS</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
          autoFocus
        />
        {error && <p className="text-bad text-sm">{error}</p>}
        <button className="btn w-full bg-brand/10 border-brand/40 text-brand">Sign in</button>
      </form>
    </div>
  );
}
