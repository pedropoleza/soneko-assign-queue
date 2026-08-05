import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { SeriesPoint } from '@/types';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  previous,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  previous?: number;
  icon?: ReactNode;
}) {
  const current = typeof value === 'number' ? value : Number(value.toString().replace(/\D/g, ''));
  const showTrend = previous !== undefined && Number.isFinite(current);
  const delta = showTrend ? current - previous : 0;
  const deltaPct = showTrend && previous > 0 ? Math.round((delta / previous) * 100) : null;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        {icon && <span className="text-ink-300">{icon}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {showTrend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-ink-400',
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : delta < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {deltaPct !== null ? `${Math.abs(deltaPct)}%` : Math.abs(delta)}
          </span>
        )}
        {hint && <span className="text-ink-400">{hint}</span>}
      </div>
    </div>
  );
}

/** Barras duplas por dia: cliques (claro) x envios (escuro). */
export function DailyChart({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(-30);
  const max = Math.max(1, ...data.map((d) => d.clicks));

  if (!data.length) {
    return <div className="px-5 py-10 text-center text-xs text-ink-400">Sem dados no período.</div>;
  }

  return (
    <div className="px-5 pb-4 pt-5">
      <div className="flex h-32 items-end gap-[3px]">
        {data.map((d) => {
          const ch = Math.max(2, Math.round((d.clicks / max) * 100));
          const sh = d.clicks ? Math.round((d.sends / max) * 100) : 0;
          const day = new Date(`${d.day}T12:00:00`);
          return (
            <div
              key={d.day}
              // h-full aqui é o que dá altura definida para as barras em % resolverem.
              className="group flex h-full flex-1 items-end"
              title={`${day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.clicks} cliques · ${d.sends} envios`}
            >
              <div className="relative w-full overflow-hidden rounded-t bg-brand-100" style={{ height: `${ch}%` }}>
                <div
                  className="absolute inset-x-0 bottom-0 bg-brand-600"
                  style={{ height: `${d.clicks ? (sh / ch) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
        <span>{new Date(`${data[0].day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-100" /> cliques
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-600" /> envios
          </span>
        </span>
        <span>
          {new Date(`${data[data.length - 1].day}T12:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      </div>
    </div>
  );
}

/** Barra horizontal simples para rankings (parceiro, origem, dispositivo). */
export function RankBar({
  label,
  value,
  total,
  secondary,
}: {
  label: string;
  value: number;
  total: number;
  secondary?: string;
}) {
  const width = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;
  return (
    <div className="px-5 py-2.5">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate font-medium text-ink-800">{label}</span>
        <span className="shrink-0 tabular-nums text-ink-500">
          {value}
          {secondary && <span className="ml-1.5 text-ink-400">{secondary}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
