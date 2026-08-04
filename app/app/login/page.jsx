"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) { window.location.href = "/"; return; }
    const d = await res.json().catch(() => ({}));
    setErr(d.error || "Login failed.");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form onSubmit={submit} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "32px 36px", width: 340 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          <div className="brand-mark">RR</div>
          <div><h1 style={{ fontSize: 17, margin: 0 }}>RankRentOS</h1><span style={{ fontSize: 12, color: "var(--muted)" }}>Sign in to continue</span></div>
        </div>
        <input
          type="password" autoFocus placeholder="Password" value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, marginBottom: 10 }}
        />
        {err && <div style={{ color: "var(--bad)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
        <button disabled={busy} style={{ width: "100%", padding: "10px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
