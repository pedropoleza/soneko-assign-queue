import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { colorFromString } from '@/lib/utils';
import type { DistributionByRep, SalesRep } from '@/types';

export function DistributionChart({
  days = 7,
  reps,
}: {
  days?: number;
  reps?: SalesRep[];
}) {
  const [data, setData] = useState<DistributionByRep[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.distribution(days).then((r) => { if (!cancelled) setData(r.by_rep); }).catch(() => {});
    return () => { cancelled = true; };
  }, [days]);

  // Merge with rep list so every active rep has a row (even with 0 leads).
  const merged = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.map((r) => [r.rep_id, r]));
    const allReps = (reps ?? []).filter((r) => r.active);
    const result = allReps.map((rep) => {
      const found = byId.get(rep.id);
      return {
        rep_id: rep.id,
        rep_name: rep.name,
        day_count: found?.day_count ?? 0,
      };
    });
    // Append reps that appear in data but not in active list (e.g. deactivated mid-period)
    for (const d of data) {
      if (!allReps.find((r) => r.id === d.rep_id)) {
        result.push({ rep_id: d.rep_id, rep_name: d.rep_name, day_count: d.day_count });
      }
    }
    return result.sort((a, b) => b.day_count - a.day_count);
  }, [data, reps]);

  const max = merged && merged[0] ? Math.max(merged[0].day_count, 1) : 1;
  const total = merged?.reduce((s, r) => s + r.day_count, 0) ?? 0;

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-ink-400" /> Distribuição da semana
          </div>
          <div className="text-xs text-ink-500">
            Últimos {days} dias · {total} lead{total === 1 ? '' : 's'} total
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        {!merged ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 rounded bg-ink-100 animate-pulse" />
            ))}
          </div>
        ) : merged.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-500">Sem dados ainda nesse período.</div>
        ) : (
          <div className="space-y-2">
            {merged.map((r) => {
              const pct = total > 0 ? (r.day_count / max) * 100 : 0;
              const color = colorFromString(r.rep_name);
              const totalPct = total > 0 ? Math.round((r.day_count / total) * 100) : 0;
              return (
                <div key={r.rep_id} className="grid grid-cols-[160px_1fr_64px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-700 font-medium">{r.rep_name}</span>
                  <div className="h-5 rounded bg-ink-100/80 overflow-hidden relative">
                    {r.day_count > 0 && (
                      <div className={`absolute inset-y-0 left-0 ${color} rounded transition-all duration-500`}
                           style={{ width: `${pct}%` }} />
                    )}
                    {r.day_count > 0 && pct > 18 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">
                        {r.day_count}
                      </span>
                    )}
                  </div>
                  <div className="text-right tabular-nums text-xs">
                    <span className="font-semibold text-ink-900">{r.day_count}</span>
                    {total > 0 && <span className="ml-1 text-[10px] text-ink-500">{totalPct}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
