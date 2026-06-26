import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '@/api';
import { publicUrl } from '@/config';
import type { Analytics, QrCode } from '@/types';

const RANGES = [7, 30, 90] as const;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2.5">
      <div className="text-xl font-semibold tabular-nums text-ink-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function BarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  if (data.length === 0) {
    return <div className="grid h-32 place-items-center text-xs text-ink-400">Sem scans no período.</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-32 items-end gap-0.5">
      {data.map((d) => (
        <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className="w-full rounded-sm bg-brand-500 transition-colors group-hover:bg-brand-600"
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
          />
          <div className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.day.slice(5)} · {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-400">Sem dados.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-ink-700">{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-500">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalyticsModal({ qr, onClose }: { qr: QrCode | null; onClose: () => void }) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!qr) return;
    setLoading(true);
    api.analytics(qr.id, days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [qr, days]);

  return (
    <Modal
      open={!!qr}
      onClose={onClose}
      title={qr ? `Analytics · ${qr.name || qr.slug}` : 'Analytics'}
      subtitle={qr ? publicUrl(qr.slug) : undefined}
      wide
    >
      {!qr ? null : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    days === r ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total (sempre)" value={data?.total ?? '—'} />
            <Stat label={`Scans ${days}d`} value={data?.in_range ?? '—'} />
            <Stat label={`Únicos ${days}d`} value={data?.unique_visitors ?? '—'} />
            <Stat
              label="Último scan"
              value={data?.last_scan_at ? new Date(data.last_scan_at).toLocaleDateString('pt-BR') : '—'}
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Scans por dia</h4>
            <BarChart data={data?.by_day ?? []} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TopList
              title="Top países"
              rows={(data?.top_countries ?? []).map((c) => ({ label: c.country, count: c.count }))}
            />
            <TopList
              title="Top cidades"
              rows={(data?.top_cities ?? []).map((c) => ({ label: c.city, count: c.count }))}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
