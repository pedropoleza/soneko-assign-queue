import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { BarChart3, Calendar, Download, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { cn, colorFromString, formatAdaptive } from '@/lib/utils';
import type { AppState } from '@/types';

type PresetId =
  | 'today' | 'this_week' | 'last_week' | 'this_month'
  | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today', label: 'Hoje' },
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
    case 'this_week': {
      const day = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1..Sun=7
      start.setDate(now.getDate() - (day - 1));
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      start.setDate(now.getDate() - (day - 1) - 7);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 7 * 86400000 - 1);
      break;
    }
    case 'this_month':
      start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case 'last_month':
      start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0); end.setHours(23, 59, 59, 999);
      break;
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3); start.setDate(1); start.setHours(0, 0, 0, 0);
      break;
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
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.report>> | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeFor(preset, { start: customStart, end: customEnd }), [preset, customStart, customEnd]);

  useEffect(() => {
    if (preset === 'custom' && (!customStart || !customEnd)) return;
    setLoading(true);
    api.report(range.start.toISOString(), range.end.toISOString())
      .then(setReport)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [range.start, range.end, preset, customStart, customEnd]);

  const sortedReps = useMemo(() => {
    return (report?.by_rep ?? []).slice().sort((a, b) => b.total - a.total);
  }, [report]);
  const max = sortedReps[0]?.total ?? 1;

  function exportCsv() {
    if (!report) return;
    const head = ['Consultor', 'Ativo', 'Total', 'Pulados', 'Falha sync', 'Primeiro', 'Último', '%'];
    const rows = sortedReps.map((r) => [
      r.name, r.active ? 'sim' : 'não',
      r.total, r.skipped, r.failed,
      r.first_at ?? '', r.last_at ?? '',
      report.totals.total > 0 ? Math.round((r.total / report.totals.total) * 100) + '%' : '0%',
    ]);
    const csv = [head, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soneko-relatorio-${range.start.toISOString().slice(0, 10)}-a-${range.end.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmtRange = `${range.start.toLocaleDateString('pt-BR')} → ${range.end.toLocaleDateString('pt-BR')}`;

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-ink-400" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                preset === p.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                   className="w-40 h-8 text-xs" />
            <span className="text-xs text-ink-400">até</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                   className="w-40 h-8 text-xs" />
          </div>
        )}
        <div className="text-[11px] text-ink-500 ml-auto flex items-center gap-3">
          <span>{fmtRange}</span>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Total no período</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">{report?.totals.total ?? '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Pulados</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-amber-700">{report?.totals.skipped ?? '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">Falhas de sync</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-rose-700">{report?.totals.failed ?? '—'}</div>
        </div>
      </div>

      {/* By rep table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-ink-400" /> Leads por consultor
            </div>
            <div className="text-xs text-ink-500">{sortedReps.length} consultor(es) no período</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-2.5 font-medium">Consultor</th>
                <th className="px-3 py-2.5 font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium w-2/5">Volume</th>
                <th className="px-3 py-2.5 font-medium">Pulados</th>
                <th className="px-3 py-2.5 font-medium">Falhas</th>
                <th className="px-3 py-2.5 font-medium">Último</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-8 text-center text-xs text-ink-400">Carregando…</td></tr>
              )}
              {!loading && sortedReps.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-xs text-ink-400">Sem dados no período</td></tr>
              )}
              {!loading && sortedReps.map((r) => {
                const pct = r.total > 0 ? (r.total / max) * 100 : 0;
                const totalPct = report && report.totals.total > 0
                  ? Math.round((r.total / report.totals.total) * 100) : 0;
                const color = colorFromString(r.name);
                return (
                  <tr key={r.rep_id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50">
                    <td className="px-5 py-3">
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
                    <td className="px-3 py-3">
                      <div className="h-5 rounded bg-ink-100/80 overflow-hidden relative">
                        {r.total > 0 && (
                          <div className={cn('absolute inset-y-0 left-0 rounded transition-all duration-500', color)}
                               style={{ width: `${pct}%` }} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-amber-700 tabular-nums">{r.skipped}</td>
                    <td className="px-3 py-3 text-rose-700 tabular-nums">{r.failed}</td>
                    <td className="px-3 py-3 text-xs text-ink-600">{r.last_at ? formatAdaptive(r.last_at) : '—'}</td>
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
    </div>
  );
}

function DailyBars({ data }: { data: Array<{ day: string; count: number }> }) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full bg-ink-100 rounded-t relative h-full flex flex-col justify-end">
              <div className="bg-brand-500 rounded-t transition-all duration-500"
                   style={{ height: `${pct}%` }}
                   title={`${d.day}: ${d.count} leads`} />
            </div>
            <span className="text-[9px] text-ink-400 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
