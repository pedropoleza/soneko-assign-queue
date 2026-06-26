import { QrCode as QrIcon, ScanLine, Power, Users } from 'lucide-react';
import type { Overview } from '@/types';

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint?: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none tabular-nums text-ink-900">{value}</div>
        <div className="mt-1 truncate text-xs text-ink-500">{label}{hint ? ` · ${hint}` : ''}</div>
      </div>
    </div>
  );
}

function ScansChart({ data, days }: { data: Array<{ day: string; count: number }>; days: number }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-700">Scans por dia</h3>
        <span className="text-xs text-ink-400">últimos {days} dias · {total} no total</span>
      </div>
      {data.length === 0 ? (
        <div className="grid h-28 place-items-center text-sm text-ink-400">Sem scans no período.</div>
      ) : (
        <div className="flex h-28 items-end gap-0.5">
          {data.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <div className="w-full rounded-sm bg-brand-500 transition-colors group-hover:bg-brand-600"
                style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }} />
              <div className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded-md bg-ink-900 px-2 py-0.5 text-xs text-white group-hover:block">
                {d.day.slice(5)} · {d.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Dashboard({ data }: { data: Overview | null }) {
  const days = data?.days ?? 30;
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<QrIcon className="h-5 w-5" />} label="QR codes"
          value={data?.total_qrs ?? '—'} hint={data ? `${data.active_qrs} ativos` : undefined} />
        <StatCard icon={<ScanLine className="h-5 w-5" />} label="Scans (total)" value={data?.total_scans ?? '—'} />
        <StatCard icon={<Power className="h-5 w-5" />} label={`Scans ${days}d`} value={data?.scans_in_range ?? '—'} />
        <StatCard icon={<Users className="h-5 w-5" />} label={`Únicos ${days}d`} value={data?.unique_in_range ?? '—'} />
      </div>
      <ScansChart data={data?.by_day ?? []} days={days} />
    </div>
  );
}
