import { useState } from 'react';
import { Loader2, QrCode as QrIcon, ScanLine, Power, Users } from 'lucide-react';
import type { Overview } from '@/types';
import { ScansBarChart } from './ScansBarChart';

const PRESETS = [
  { label: 'Semana', days: 7 },
  { label: 'Mês', days: 30 },
  { label: 'Trimestre', days: 90 },
] as const;

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

export function Dashboard({
  data, days, loading, onDays,
}: {
  data: Overview | null;
  days: number;
  loading: boolean;
  onDays: (d: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDays, setCustomDays] = useState<number>(14);

  const onPreset = (d: number) => { setCustomOpen(false); onDays(d); };
  const openCustom = () => { setCustomOpen(true); onDays(customDays); };
  const applyCustom = (v: number) => {
    const n = Math.max(1, Math.min(365, Math.round(v || 0)));
    setCustomDays(n);
    onDays(n);
  };

  const periodLabel = customOpen ? `${days}d` : (PRESETS.find((p) => p.days === days)?.label ?? `${days}d`);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<QrIcon className="h-5 w-5" />} label="QR codes"
          value={data?.total_qrs ?? '—'} hint={data ? `${data.active_qrs} ativos` : undefined} />
        <StatCard icon={<ScanLine className="h-5 w-5" />} label="Scans (total)" value={data?.total_scans ?? '—'} />
        <StatCard icon={<Power className="h-5 w-5" />} label={`Scans · ${periodLabel}`} value={data?.scans_in_range ?? '—'} />
        <StatCard icon={<Users className="h-5 w-5" />} label={`Únicos · ${periodLabel}`} value={data?.unique_in_range ?? '—'} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-700">Scans por dia</h3>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
          </div>

          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => onPreset(p.days)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  !customOpen && days === p.days ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={openCustom}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                customOpen ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-100'
              }`}
            >
              Custom
            </button>
            {customOpen && (
              <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-2 py-1">
                <span className="text-xs text-ink-400">últimos</span>
                <input
                  type="number" min={1} max={365} value={customDays}
                  onChange={(e) => applyCustom(Number(e.target.value))}
                  className="w-14 bg-transparent text-sm font-medium text-ink-900 outline-none"
                />
                <span className="text-xs text-ink-400">dias</span>
              </div>
            )}
          </div>
        </div>
        <ScansBarChart byDay={data?.by_day ?? []} days={days} heightClass="h-32" />
      </div>
    </div>
  );
}
