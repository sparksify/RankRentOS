'use client';
import { useState } from 'react';

// Run Discovery: re-runs the in-database qualification pipeline over the
// canonical corpus. Paid deep research (SERP refresh, keyword refresh) runs
// through the worker/provider scripts when API keys are configured — see the
// Runbook. Budget fields are stored on the job for cost governance.
export default function Discovery() {
  const [budget, setBudget] = useState('25');
  const [deepN, setDeepN] = useState('30');
  const [state, setState] = useState('');
  const [minPop, setMinPop] = useState('15000');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/jobs/qualify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budgetUsd: Number(budget), maxDeepResearch: Number(deepN), state: state || null, minPopulation: Number(minPop) }),
      });
      const data = await res.json();
      setResult(res.ok ? `Qualification complete: ${JSON.stringify(data.result)}` : `Failed: ${data.error}`);
    } catch (e) {
      setResult(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Run Discovery</h1>
      <p className="text-sm text-slate-400">
        Re-runs low-cost qualification (qual-v1.0) across all 1,392 markets using the freshest stored observations.
        Free — uses no paid providers. Deep research on top candidates (SERP + keyword refresh) requires provider
        keys and runs via the pipeline worker (see Runbook); its budget caps are configured here and stored on the job.
      </p>
      <div className="panel p-6 grid grid-cols-2 gap-4">
        <label className="text-sm space-y-1 block">
          <span className="text-slate-400">Max research budget (USD)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="text-slate-400">Max deep-research candidates</span>
          <input value={deepN} onChange={(e) => setDeepN(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="text-slate-400">State filter (optional, e.g. TX)</span>
          <input value={state} onChange={(e) => setState(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="text-slate-400">Minimum population</span>
          <input value={minPop} onChange={(e) => setMinPop(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-3 py-2" />
        </label>
        <div className="col-span-2">
          <button onClick={run} disabled={busy} className="btn bg-brand/10 border-brand/40 text-brand disabled:opacity-50">
            {busy ? 'Running qualification…' : 'Run Qualification (free)'}
          </button>
        </div>
      </div>
      {result && <div className="panel p-4 text-sm">{result}</div>}
    </div>
  );
}
