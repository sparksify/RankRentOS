// Supabase anon credentials (public-scope key; project is private-use)
export const SUPABASE_URL = "https://dmvkmbbpcvcetuepwhue.supabase.co";
export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmttYmJwY3ZjZXR1ZXB3aHVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNDg5OTksImV4cCI6MjA5OTgyNDk5OX0.B4jKX3xW_fuA-x5J7J_lGYSQkTuyG-Zq6-xF6vlwvFM";

export async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      prefer: opts.method && opts.method !== "GET" ? "return=representation" : "count=exact",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
