"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function QueueBanner() {
  const [q, setQ] = useState(null);
  useEffect(() => {
    try { const raw = localStorage.getItem("rros-purchase-queue"); if (raw) setQ(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  if (!q || !q.length) return null;
  const domains = [...new Set(q.map((r) => r.domain).filter(Boolean))];
  const cost = domains.length * 12.18;
  return (
    <div className="queuecard" role="region" aria-label="purchase queue">
      <h3 style={{ margin: "0 0 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--good)", fontWeight: 750 }}>
        Your purchase queue — {q.length} asset{q.length === 1 ? "" : "s"} · {domains.length} domain{domains.length === 1 ? "" : "s"} · est. ${cost.toFixed(2)}
      </h3>
      <div className="domain-mono">
        {domains.map((d) => <div key={d}>{d}</div>)}
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        Queued from <Link href="/cockpit/portfolio">Final Portfolio</Link>. RankRentOS never purchases automatically — buy these at your registrar, then mark them owned.{" "}
        <button onClick={() => { localStorage.removeItem("rros-purchase-queue"); location.reload(); }}
          style={{ background: "none", border: "none", color: "var(--ink-2)", font: "inherit", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear queue</button>
      </p>
    </div>
  );
}
