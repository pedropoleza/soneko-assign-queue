import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { colorFromString } from '@/lib/utils';
import type { DistributionByRep } from '@/types';

export function DistributionChart({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<DistributionByRep[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.distribution(days).then((r) => { if (!cancelled) setData(r.by_rep); }).catch(() => {});
    return () => { cancelled = true; };
  }, [days]);

  const sorted = useMemo(() => (data ?? []).slice().sort((a, b) => b.day_count - a.day_count), [data]);
  const max = sorted[0]?.day_count ?? 1;

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-ink-400" /> Distribuição (últimos {days} dias)
          </div>
          <div className="text-xs text-ink-500">Leads recebidos por consultor</div>
        </div>
      </div>
      <div className="p-5">
        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-ink-100 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-500">Sem dados ainda nesse período.</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((r) => {
              const pct = (r.day_count / max) * 100;
              const color = colorFromString(r.rep_name);
              return (
                <div key={r.rep_id} className="grid grid-cols-[140px_1fr_40px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-700">{r.rep_name}</span>
                  <div className="h-5 rounded-md bg-ink-100 overflow-hidden relative">
                    <div className={`absolute inset-y-0 left-0 ${color} rounded-md transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums text-ink-900">{r.day_count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
