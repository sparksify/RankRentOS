// Server-side only. Credentials come from env; never shipped to the browser.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export async function sb(path, opts = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY not set");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    cache: "no-store",
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
