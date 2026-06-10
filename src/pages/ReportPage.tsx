import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { BarChart3, Calendar, ChevronRight, Download, Radio, Tag, Trophy, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TrendArrow } from '@/components/ui/TrendArrow';
import { RepLeadsDrawer } from '@/components/RepLeadsDrawer';
import { api } from '@/lib/api';
import { cn, colorFromString, formatAdaptive } from '@/lib/utils';
import type { AppState } from '@/types';

type PresetId =
  | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month'
  | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'this_week', label: 'Esta semana' },
  { id: 'last_week', label: 'Semana passada' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: 'last_3_months', label: 'Últimos 3 meses' },
  { id: 'this_year', label: 'Este ano' },
  { id: 'custom', label: 'Customizado' },
];

function rangeFor(id: PresetId, custom?: { start: string; end: string }): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now); const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (id) {
    case 'today':
      start.setHours(0, 0, 0, 0); break;
    case 'yesterday':
      start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999); break;
    case 'this_week': {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      start.setDate(now.getDate() - (day - 1));
      start.setHours(0, 0, 0, 0); break;
    }
    case 'last_week': {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      start.setDate(now.getDate() - (day - 1) - 7);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 7 * 86400000 - 1); break;
    }
    case 'this_month':
      start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case 'last_month':
      start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0); end.setHours(23, 59, 59, 999); break;
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3); start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case 'this_year':
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0); break;
    case 'custom': {
      const s = custom?.start ? new Date(custom.start + 'T00:00:00') : start;
      const e = custom?.end ? new Date(custom.end + 'T23:59:59') : end;
      return { start: s, end: e };
    }
  }
  return { start, end };
}

export function ReportPage({ state: _state }: { state: AppState }) {
  const [preset, setPreset] = useState<PresetId>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.report>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerRep, setDrawerRep] = useState<any | null>(null);

  const range = useMemo(() => rangeFor(preset, { start: customStart, end: customEnd }), [preset, customStart, customEnd]);

  useEffect(() => {
    if (preset === 'custom' && (!customStart || !customEnd)) return;
    setLoading(true);
    api.report(range.start.toISOString(), range.end.toISOString(), source)
      .then(setReport)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [range.start, range.end, preset, customStart, customEnd, source]);

  const sortedReps = useMemo(() => (report?.by_rep ?? []).slice().sort((a, b) => b.total - a.total), [report]);
  const max = sortedReps[0]?.total ?? 1;
  const periodDays = report ? Math.max(1, Math.round(report.range_seconds / 86400)) : 1;

  function exportCsv() {
    if (!report) return;
    const head = ['Rank', 'Consultor', 'Ativo', 'Total', '%', 'vs período anterior', 'Pulados', 'Falhas', 'Dias ativos', 'Melhor dia', 'Leads no melhor dia', 'Média/dia ativo', 'Primeiro', 'Último'];
    const rows = sortedReps.map((r, i) => {
      const prev = report.previous.by_rep[r.rep_id] ?? 0;
      const change = prev > 0 ? Math.round(((r.total - prev) / prev) * 100) + '%' : (r.total > 0 ? 'novo' : '0%');
      const avgPerActive = r.active_days > 0 ? (r.total / r.active_days).toFixed(1) : '0';
      return [
        i + 1, r.name, r.active ? 'sim' : 'não',
        r.total,
        report.totals.total > 0 ? Math.round((r.total / report.totals.total) * 100) + '%' : '0%',
        change, r.skipped, r.failed, r.active_days,
        r.best_day ?? '', r.best_day_count, avgPerActive,
        r.first_at ?? '', r.last_at ?? '',
      ];
    });
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soneko-relatorio-${range.start.toISOString().slice(0, 10)}-a-${range.end.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmtRange = `${range.start.toLocaleDateString('pt-BR')} → ${range.end.toLocaleDateString('pt-BR')}`;
  const champion = sortedReps[0];
  const avgPerRepPerDay = sortedReps.length > 0 && periodDays > 0
    ? (report?.totals.total ?? 0) / sortedReps.filter((r) => r.active).length / periodDays
    : 0;

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-ink-400" />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        preset === p.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                      )}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40 h-8 text-xs" />
              <span className="text-xs text-ink-400">até</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40 h-8 text-xs" />
            </div>
          )}
          <div className="text-[11px] text-ink-500 ml-auto flex items-center gap-3">
            <span>{fmtRange}</span>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
        {report && report.by_source.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-ink-100">
            <Radio className="h-3.5 w-3.5 text-ink-400 mr-1" />
            <button onClick={() => setSource(null)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                      source === null ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                    )}>
              Todos os canais
            </button>
            {report.by_source.map((s) => (
              <button key={s.source} onClick={() => setSource(s.source)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors inline-flex items-center gap-1.5',
                        source === s.source ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                      )}>
                {s.source}
                <span className={cn(
                  'rounded-full px-1 text-[10px] tabular-nums',
                  source === s.source ? 'bg-white/20' : 'bg-white/70',
                )}>{s.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Totals + comparison */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Total no período</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tabular-nums text-ink-900">{report?.totals.total ?? '—'}</div>
            {report && <TrendArrow current={report.totals.total} previous={report.previous.total} />}
          </div>
          <div className="mt-1 text-[11px] text-ink-500">vs anterior: {report?.previous.total ?? 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Pulados</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-amber-700">{report?.totals.skipped ?? '—'}</div>
          <div className="mt-1 text-[11px] text-ink-500">
            {report && report.totals.total > 0
              ? `${Math.round((report.totals.skipped / report.totals.total) * 100)}% do total`
              : '—'}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Falhas de sync</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-rose-700">{report?.totals.failed ?? '—'}</div>
          <div className="mt-1 text-[11px] text-ink-500">{periodDays} dia(s) no período</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-brand-50/40 to-white">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-amber-500" /> Líder do período
          </div>
          {champion ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <Avatar name={champion.name} src={champion.avatar_url} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{champion.name}</div>
                  <div className="text-[11px] text-ink-500">{champion.total} leads</div>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                média {avgPerRepPerDay.toFixed(1)} leads/dia/ativo
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-ink-400">—</div>
          )}
        </div>
      </div>

      {/* Top tags */}
      {report && report.top_tags.length > 0 && (
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Tags mais frequentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.top_tags.map((t) => (
              <Badge key={t.tag} tone="brand">
                {t.tag}
                <span className="ml-1 text-[10px] opacity-70">×{t.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* By rep table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-ink-400" /> Leads por consultor
            </div>
            <div className="text-xs text-ink-500">Click em uma linha para ver todos os leads desse consultor no período</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-2.5 font-medium w-10">#</th>
                <th className="px-3 py-2.5 font-medium">Consultor</th>
                <th className="px-3 py-2.5 font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">vs ant.</th>
                <th className="px-3 py-2.5 font-medium w-1/3">Volume</th>
                <th className="px-3 py-2.5 font-medium">Dias ativos</th>
                <th className="px-3 py-2.5 font-medium">Melhor dia</th>
                <th className="px-3 py-2.5 font-medium">Pulados</th>
                <th className="px-3 py-2.5 font-medium">Falhas</th>
                <th className="px-3 py-2.5 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-ink-400">Carregando…</td></tr>
              )}
              {!loading && sortedReps.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-ink-400">Sem dados no período</td></tr>
              )}
              {!loading && sortedReps.map((r, i) => {
                const pct = r.total > 0 ? (r.total / max) * 100 : 0;
                const totalPct = report && report.totals.total > 0
                  ? Math.round((r.total / report.totals.total) * 100) : 0;
                const color = colorFromString(r.name);
                const prev = report?.previous.by_rep[r.rep_id] ?? 0;
                return (
                  <tr key={r.rep_id}
                      onClick={() => setDrawerRep(r)}
                      className="border-b border-ink-100 last:border-0 hover:bg-brand-50/40 cursor-pointer">
                    <td className="px-5 py-3">
                      <span className={cn(
                        'inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-semibold',
                        i === 0 ? 'bg-amber-100 text-amber-800' :
                        i === 1 ? 'bg-ink-200 text-ink-800' :
                        i === 2 ? 'bg-orange-100 text-orange-800' :
                                  'bg-ink-100 text-ink-600',
                      )}>{i + 1}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} src={r.avatar_url} size="sm"
                                status={r.active ? 'available' : 'inactive'} />
                        <div>
                          <div className="font-medium text-ink-900">{r.name}</div>
                          {!r.active && <Badge tone="neutral" className="mt-0.5">Inativo</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-lg font-semibold text-ink-900 tabular-nums">{r.total}</span>
                      <span className="ml-1 text-[10px] text-ink-500">({totalPct}%)</span>
                    </td>
                    <td className="px-3 py-3"><TrendArrow current={r.total} previous={prev} /></td>
                    <td className="px-3 py-3">
                      <div className="h-5 rounded bg-ink-100/80 overflow-hidden relative">
                        {r.total > 0 && (
                          <div className={cn('absolute inset-y-0 left-0 rounded transition-all duration-500', color)}
                               style={{ width: `${pct}%` }} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-700 tabular-nums text-xs">{r.active_days}</td>
                    <td className="px-3 py-3 text-xs text-ink-700">
                      {r.best_day ? (
                        <span>
                          <span className="font-semibold">{r.best_day_count}</span>
                          <span className="ml-1 text-[10px] text-ink-500">
                            {new Date(r.best_day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-amber-700 tabular-nums">{r.skipped}</td>
                    <td className="px-3 py-3 text-rose-700 tabular-nums">{r.failed}</td>
                    <td className="px-3 py-3"><ChevronRight className="h-4 w-4 text-ink-300" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily volume */}
      {report && report.by_day.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-ink-400" /> Volume diário
              </div>
              <div className="text-xs text-ink-500">{report.by_day.length} dia(s) com atividade</div>
            </div>
          </div>
          <div className="px-5 py-5">
            <DailyBars data={report.by_day} />
          </div>
        </div>
      )}

      {/* Last activity */}
      {sortedReps.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="card-title">Última atividade</div>
          </div>
          <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {sortedReps.filter((r) => r.last_at).slice(0, 12).map((r) => (
              <div key={r.rep_id} className="flex items-center gap-2 min-w-0">
                <Avatar name={r.name} src={r.avatar_url} size="xs" />
                <div className="min-w-0">
                  <div className="font-medium text-ink-800 truncate">{r.name}</div>
                  <div className="text-[10px] text-ink-500">{r.last_at ? formatAdaptive(r.last_at) : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepLeadsDrawer
        open={!!drawerRep}
        onClose={() => setDrawerRep(null)}
        rep={drawerRep}
        startISO={range.start.toISOString()}
        endISO={range.end.toISOString()}
      />
    </div>
  );
}

function DailyBars({ data }: { data: Array<{ day: string; count: number }> }) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-sm text-ink-500">Sem leads no período.</div>;
  }
  const max = data.reduce((m, d) => Math.max(m, d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const trackPx = 160; // total bar track height
  const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  // Show every Nth label so they don't overlap
  const labelEvery = Math.max(1, Math.ceil(data.length / 12));
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height: `${trackPx}px` }}>
        {data.map((d) => {
          const heightPx = Math.max(d.count > 0 ? 4 : 0, Math.round((d.count / max) * trackPx));
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
              <span className="text-[10px] text-ink-600 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                {d.count}
              </span>
              <div
                className="w-full bg-brand-500 hover:bg-brand-600 rounded-t transition-colors"
                style={{ height: `${heightPx}px` }}
                title={`${fmtDay(d.day)}: ${d.count} leads`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-ink-400 tabular-nums">
        {data.map((d, i) => (
          <span key={d.day} className="flex-1 text-center truncate">
            {i % labelEvery === 0 ? fmtDay(d.day) : ''}
          </span>
        ))}
      </div>
      <div className="text-[11px] text-ink-500 text-center pt-1">{total} leads no período</div>
    </div>
  );
}
