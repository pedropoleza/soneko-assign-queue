import type { MonthPoint, SeriesPoint } from '@/types';
import { cn, pct } from '@/lib/utils';

/** Número grande. O rótulo vem depois do valor — o olho pega o número primeiro. */
export function BigStat({
  value,
  label,
  sub,
  tone = 'ink',
}: {
  value: string | number;
  label: string;
  sub?: string;
  tone?: 'ink' | 'accent';
}) {
  return (
    <div className="card px-5 py-4">
      <div
        className={cn(
          'num text-[30px] font-semibold leading-none',
          tone === 'accent' ? 'text-accent-deep' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Anel de conversão: quantos dos que clicaram realmente enviaram. */
export function Ring({ part, total, size = 44 }: { part: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, part / total) : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
          className="stroke-accent transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink">
        {total > 0 ? `${Math.round(ratio * 100)}%` : '—'}
      </span>
    </div>
  );
}

/** Barras por dia: claro = cliques, escuro = quem enviou. */
export function DayBars({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(-30);
  const max = Math.max(1, ...data.map((d) => d.clicks));

  if (!data.length) {
    return <div className="px-6 py-14 text-center text-sm text-ink-3">Sem dados no período.</div>;
  }

  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', opts);

  return (
    <div className="px-5 pb-4 pt-2">
      <div className="flex h-36 items-end gap-1">
        {data.map((d) => {
          const h = Math.max(3, Math.round((d.clicks / max) * 100));
          return (
            <div
              key={d.day}
              className="group flex h-full flex-1 items-end"
              title={`${fmt(d.day, { day: '2-digit', month: '2-digit' })} · ${d.clicks} cliques · ${d.sends} enviaram`}
            >
              <div
                className="relative w-full overflow-hidden rounded-md bg-accent/20 transition group-hover:bg-accent/30"
                style={{ height: `${h}%` }}
              >
                <div
                  className="absolute inset-x-0 bottom-0 rounded-md bg-accent"
                  style={{ height: `${d.clicks ? (d.sends / d.clicks) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-3">
        <span>{fmt(data[0].day, { day: '2-digit', month: 'short' })}</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-accent/20" /> clicaram
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-accent" /> enviaram
          </span>
        </span>
        <span>{fmt(data[data.length - 1].day, { day: '2-digit', month: 'short' })}</span>
      </div>
    </div>
  );
}

/** Linha de ranking: rótulo, barra e os dois números que importam. */
export function RankRow({
  label,
  meta,
  clicks,
  sends,
  max,
  onClick,
}: {
  label: string;
  meta?: string;
  clicks: number;
  sends: number;
  max: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-center gap-4 px-5 py-3.5 text-left transition',
        onClick && 'hover:bg-surface-2',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-ink">{label}</span>
          {meta && <span className="shrink-0 text-[11px] text-ink-3">{meta}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent/35"
            style={{ width: `${max > 0 ? Math.max(2, (clicks / max) * 100) : 0}%` }}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${clicks > 0 ? (sends / clicks) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
      <div className="num shrink-0 text-right">
        <div className="text-lg font-semibold leading-none text-ink">{sends}</div>
        <div className="mt-1 text-[11px] text-ink-3">
          de {clicks} · {pct(sends, clicks)}
        </div>
      </div>
    </Wrapper>
  );
}

/** Barras por mês — mesma leitura das barras diárias, na escala da pasta. */
export function MonthBars({ months }: { months: MonthPoint[] }) {
  const max = Math.max(1, ...months.map((m) => m.clicks));
  if (!months.length) {
    return <div className="px-6 py-10 text-center text-sm text-ink-3">Sem histórico.</div>;
  }

  const label = (m: string) =>
    new Date(`${m}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

  return (
    <div className="px-5 pb-4 pt-3">
      <div className="flex h-28 items-end gap-2">
        {months.map((m) => (
          <div
            key={m.month}
            className="group flex h-full flex-1 items-end"
            title={`${m.clicks} cliques · ${m.sends} enviaram`}
          >
            <div
              className="relative w-full overflow-hidden rounded-lg bg-accent/15 transition group-hover:bg-accent/25"
              style={{ height: `${Math.max(6, (m.clicks / max) * 100)}%` }}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-lg bg-accent"
                style={{ height: `${m.clicks ? (m.sends / m.clicks) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {months.map((m) => (
          <div key={m.month} className="flex-1 text-center text-[11px] text-ink-3">
            {label(m.month)}
          </div>
        ))}
      </div>
    </div>
  );
}
