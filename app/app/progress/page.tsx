import { select } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STAGE_LABELS: Record<string, string> = {
  qualification: 'Low-cost qualification',
  qualification_ui: 'Low-cost qualification (from app)',
  deep_scoring: 'Deep research scoring',
};

export default async function Progress() {
  const jobs = await select<any>('rros_jobs', 'select=*&order=requested_at.desc&limit=25');
  const tasks = await select<any>('rros_tasks', 'select=id,job_id,type,status,retry_count,error&limit=200');
  const tasksByJob = new Map<string, any[]>();
  for (const t of tasks) {
    tasksByJob.set(t.job_id, [...(tasksByJob.get(t.job_id) ?? []), t]);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Research Progress</h1>
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id} className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{STAGE_LABELS[j.type] ?? j.type}</span>
                <span className={`chip ml-3 ${j.status === 'completed' ? 'bg-brand/10 text-brand' : j.status === 'failed' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>
                  {j.status}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {j.completed_at ? new Date(j.completed_at).toLocaleString() : j.started_at ? `started ${new Date(j.started_at).toLocaleString()}` : 'queued'}
                {' · '}${Number(j.actual_cost_usd ?? 0).toFixed(2)}
              </span>
            </div>
            {j.progress && Object.keys(j.progress).length > 0 && (
              <div className="text-sm text-slate-400 mt-2">
                {Object.entries(j.progress).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
            {j.error_summary && <div className="text-sm text-bad mt-2">{j.error_summary}</div>}
            {(tasksByJob.get(j.id)?.length ?? 0) > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer">Diagnostics ({tasksByJob.get(j.id)!.length} tasks)</summary>
                <ul className="text-xs text-slate-400 mt-2 space-y-1">
                  {tasksByJob.get(j.id)!.map((t) => (
                    <li key={t.id}>
                      {t.type} — {t.status}
                      {t.retry_count > 0 && ` (retries: ${t.retry_count})`}
                      {t.error && <span className="text-bad"> {t.error}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
