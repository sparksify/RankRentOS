'use client';
import { useState } from 'react';

export interface TargetView {
  id: string;
  opportunityId: string;
  role: 'primary' | 'alternate';
  position: number;
  decision: string;
  notes: string;
  locked: boolean;
  inclusionReasons: string[];
  niche: string;
  nicheSlug: string;
  geography: string;
  region: string;
  overall: number;
  confidence: number;
  subscores: Record<string, number>;
  reasons: string[];
  freshness: string;
  missing: string[];
  domain: string | null;
  altDomains: string[];
  domainCheckedAt: string | null;
  estCost: [number, number] | null;
  estRankMonths: [number, number] | null;
  estLeads: [number, number] | null;
  estRevenue: [number, number] | null;
  risks: string[];
  blueprintStatus: string;
}

const DECISIONS = ['approved', 'rejected', 'hold'] as const;

export default function BatchBoard({ targets }: { targets: TargetView[] }) {
  const [items, setItems] = useState(targets);
  const [busy, setBusy] = useState<string | null>(null);
  const primaries = items.filter((t) => t.role === 'primary').sort((a, b) => a.position - b.position);
  const alternates = items.filter((t) => t.role === 'alternate').sort((a, b) => a.position - b.position);

  async function update(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch('/api/batch', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...(body as Partial<TargetView>) } : t)));
    }
    setBusy(null);
  }

  async function swap(primaryId: string, alternateId: string) {
    setBusy(primaryId);
    const res = await fetch('/api/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'swap', primaryId, alternateId }),
    });
    if (res.ok) window.location.reload();
    setBusy(null);
  }

  async function move(id: string, dir: -1 | 1) {
    const list = primaries;
    const idx = list.findIndex((t) => t.id === id);
    const other = list[idx + dir];
    if (!other) return;
    await update(id, { position: other.position });
    await update(other.id, { position: list[idx].position });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Batch 1 — First 10 Assets</h1>
        <div className="flex gap-2">
          <a href="/api/export?format=csv" className="btn">Export CSV</a>
          <a href="/api/export?format=md" className="btn">Export Markdown</a>
        </div>
      </div>

      <div className="space-y-4">
        {primaries.map((t, i) => (
          <Card key={t.id} t={t} busy={busy === t.id}
            header={`#${i + 1}`}
            actions={
              <div className="flex flex-wrap gap-2 items-center">
                {DECISIONS.map((d) => (
                  <button key={d} disabled={t.locked} onClick={() => update(t.id, { decision: d })}
                    className={`btn ${t.decision === d ? (d === 'approved' ? 'bg-brand/20 border-brand text-brand' : d === 'rejected' ? 'bg-bad/20 border-bad text-bad' : 'bg-warn/20 border-warn text-warn') : ''}`}>
                    {d}
                  </button>
                ))}
                <button className="btn" onClick={() => move(t.id, -1)} disabled={i === 0 || t.locked}>↑</button>
                <button className="btn" onClick={() => move(t.id, 1)} disabled={i === primaries.length - 1 || t.locked}>↓</button>
                <button className="btn" onClick={() => update(t.id, { locked: !t.locked })}>{t.locked ? 'Unlock' : 'Lock'}</button>
                <select defaultValue="" disabled={t.locked} onChange={(e) => e.target.value && swap(t.id, e.target.value)}
                  className="bg-panel border border-edge rounded-lg px-2 py-1.5 text-sm">
                  <option value="">Replace with…</option>
                  {alternates.map((a) => <option key={a.id} value={a.id}>{a.niche} — {a.geography} ({a.overall})</option>)}
                </select>
              </div>
            }
            onNotes={(notes) => update(t.id, { notes })}
          />
        ))}
      </div>

      <h2 className="text-lg font-semibold pt-4">Alternates</h2>
      <div className="space-y-3">
        {alternates.map((t) => (
          <Card key={t.id} t={t} busy={busy === t.id} header={`ALT`} compact
            actions={<span className="text-xs text-slate-500">{t.inclusionReasons.join(' · ')}</span>}
            onNotes={(notes) => update(t.id, { notes })}
          />
        ))}
      </div>
    </div>
  );
}

function Card({ t, header, actions, onNotes, compact, busy }: {
  t: TargetView; header: string; actions: React.ReactNode; onNotes: (n: string) => void; compact?: boolean; busy?: boolean;
}) {
  const [notes, setNotes] = useState(t.notes);
  const [open, setOpen] = useState(false);
  return (
    <div className={`panel p-4 ${busy ? 'opacity-60' : ''} ${t.decision === 'approved' ? 'border-brand/50' : t.decision === 'rejected' ? 'border-bad/50 opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-mono text-sm">{header}</span>
            <a href={`/opportunities/${t.opportunityId}`} className="font-semibold hover:text-brand">{t.niche} — {t.geography}</a>
            <span className="chip bg-edge text-slate-300">{t.overall.toFixed(1)} / conf {t.confidence.toFixed(2)}</span>
            {t.locked && <span className="chip bg-brand/10 text-brand">locked</span>}
            {t.decision !== 'pending' && <span className="chip bg-edge text-slate-300">{t.decision}</span>}
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {t.domain ? <>Domain: <span className="text-slate-200 font-medium">{t.domain}</span>{t.domainCheckedAt && <span className="text-slate-500"> (verified {new Date(t.domainCheckedAt).toLocaleDateString()})</span>}</> : 'No verified domain'}
            {t.estRevenue && <> · Est. ${Number(t.estRevenue[0]).toLocaleString()}–${Number(t.estRevenue[1]).toLocaleString()}/mo</>}
            {t.estRankMonths && <> · {t.estRankMonths[0]}–{t.estRankMonths[1]} mo to rank</>}
            {t.estCost && <> · build ${Number(t.estCost[0]).toLocaleString()}–${Number(t.estCost[1]).toLocaleString()}</>}
          </div>
          {t.missing.length > 0 && (
            <div className="text-xs text-warn mt-1">Missing evidence: {t.missing.join(', ')}</div>
          )}
        </div>
        <div className="shrink-0">{actions}</div>
      </div>
      {!compact && (
        <button onClick={() => setOpen(!open)} className="text-xs text-slate-500 mt-2 hover:text-slate-300">
          {open ? 'Hide details' : 'Details, reasons & notes'}
        </button>
      )}
      {(open || compact) && (
        <div className="mt-3 space-y-2">
          {!compact && (
            <>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2 text-xs">
                {Object.entries(t.subscores).map(([k, v]) => (
                  <div key={k} className="bg-ink rounded-lg px-2 py-1.5"><div className="text-slate-500">{k}</div><div className="font-medium">{v}</div></div>
                ))}
              </div>
              <ul className="text-xs text-slate-400 space-y-0.5">
                {t.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                {t.inclusionReasons.map((r, i) => <li key={`inc-${i}`} className="text-brand/80">★ {r}</li>)}
                {t.risks.map((r, i) => <li key={`risk-${i}`} className="text-warn">⚠ {r}</li>)}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…"
              className="flex-1 bg-ink border border-edge rounded-lg px-3 py-1.5 text-sm" />
            <button className="btn" onClick={() => onNotes(notes)}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
