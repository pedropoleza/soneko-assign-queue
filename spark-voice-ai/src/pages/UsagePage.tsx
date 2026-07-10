import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { EmptyState } from '@/components/ui/primitives';
import type { AppState, AudioGeneration } from '@/types';

function topCounts(items: AudioGeneration[], key: 'event_type'): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = (it[key] as string | null) ?? '—';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-ink-900">{value}</div>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function UsagePage({ state }: { state: AppState }) {
  const { data: gens } = useAsync<AudioGeneration[]>(() => api.listGenerations(200), []);
  const u = state.usage;
  const thisMonth = (gens ?? []).filter((g) => new Date(g.created_at).getMonth() === new Date().getMonth());
  const byEvent = topCounts(thisMonth, 'event_type');

  return (
    <div>
      <p className="lead">Consumo</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Este mês</span></div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <Stat label="Saldo" value={`$${u.credit_balance.toFixed(2)}`} hint="créditos" />
            <Stat label="Gasto no mês" value={`$${u.spent_month.toFixed(2)}`} />
            <Stat label="Áudios" value={String(u.audios_month)} />
            <Stat label="Caracteres" value={u.characters_month.toLocaleString('pt-BR')} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Eventos mais usados</span></div>
          <div className="p-5">
            {byEvent.length ? (
              <ul className="space-y-2.5">
                {byEvent.map(([ev, n]) => (
                  <li key={ev} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700">{ev}</span>
                    <span className="tabular-nums text-ink-400">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sem dados no mês" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
