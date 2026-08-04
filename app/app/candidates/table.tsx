'use client';
import { useMemo, useState } from 'react';

export interface CandidateRow {
  id: string;
  niche: string;
  geography: string;
  region: string;
  result: string;
  prelim: number;
  confidence: number;
  freshness: string;
  reason: string;
  reasons: string[];
}

export default function CandidatesTable({ rows }: { rows: CandidateRow[] }) {
  const [result, setResult] = useState('all');
  const [niche, setNiche] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  const niches = useMemo(() => [...new Set(rows.map((r) => r.niche))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (result === 'all' || r.result === result) &&
      (niche === 'all' || r.niche === niche) &&
      (!q || r.geography.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center text-sm">
        <select value={result} onChange={(e) => setResult(e.target.value)} className="bg-panel border border-edge rounded-lg px-2 py-1.5">
          <option value="all">All results</option>
          <option value="passed">Passed</option>
          <option value="needs_research">Needs research</option>
          <option value="failed">Failed</option>
        </select>
        <select value={niche} onChange={(e) => setNiche(e.target.value)} className="bg-panel border border-edge rounded-lg px-2 py-1.5">
          <option value="all">All niches</option>
          {niches.map((n) => <option key={n}>{n}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city…" className="bg-panel border border-edge rounded-lg px-3 py-1.5" />
        <span className="text-slate-500">{filtered.length} markets</span>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Niche</th><th className="th">Geography</th><th className="th">Prelim score</th>
              <th className="th">Result</th><th className="th">Confidence</th><th className="th">Freshness</th><th className="th">Primary reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((r) => (
              <>
                <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer hover:bg-edge/30">
                  <td className="td">{r.niche}</td>
                  <td className="td">{r.geography}</td>
                  <td className="td font-medium">{r.prelim}</td>
                  <td className="td">
                    <span className={`chip ${r.result === 'passed' ? 'bg-brand/10 text-brand' : r.result === 'failed' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>
                      {r.result}
                    </span>
                  </td>
                  <td className="td">{r.confidence.toFixed(2)}</td>
                  <td className="td text-slate-400">{r.freshness}</td>
                  <td className="td text-slate-400 max-w-md truncate">{r.reason}</td>
                </tr>
                {open === r.id && (
                  <tr key={`${r.id}-detail`}>
                    <td className="td bg-ink/50" colSpan={7}>
                      <ul className="text-xs text-slate-400 space-y-1 py-1">
                        {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button className="btn" onClick={() => setLimit(limit + 200)}>Show more ({filtered.length - limit} remaining)</button>
      )}
    </div>
  );
}
