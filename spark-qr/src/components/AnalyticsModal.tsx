import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '@/api';
import { publicUrl } from '@/config';
import type { Analytics, QrCode } from '@/types';

const RANGES = [7, 30, 90] as const;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50 px-4 py-3">
      <div className="text-3xl font-bold tabular-nums text-ink-900">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function BarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  if (data.length === 0) {
    return <div className="grid h-44 place-items-center text-sm text-ink-400">Sem scans no período.</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-44 items-end gap-0.5">
      {data.map((d) => (
        <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className="w-full rounded-sm bg-brand-500 transition-colors group-hover:bg-brand-600"
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
          />
          <div className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded-md bg-ink-900 px-2 py-0.5 text-xs text-white group-hover:block">
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
      <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-400">Sem dados.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2.5">
              <span className="w-28 shrink-0 truncate text-sm text-ink-700">{r.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right text-sm tabular-nums text-ink-500">{r.count}</span>
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
      subtitle={qr ? publicUrl(qr.slug).replace(/^https?:\/\//, '') : undefined}
      wide
    >
      {!qr ? null : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    days === r ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-ink-400" />}
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
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Scans por dia</h4>
            <BarChart data={data?.by_day ?? []} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
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
