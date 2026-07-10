import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { EmptyState } from '@/components/ui/primitives';
import { pct } from '@/lib/utils';
import type { AppState, AudioGeneration } from '@/types';

function Bar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const p = pct(used, limit);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink-600">{label}</span>
        <span className="text-ink-400">{used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')} · {p}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function topCounts(items: AudioGeneration[], key: 'event_type' | 'template_id'): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = (it[key] as string | null) ?? '—';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function UsagePage({ state }: { state: AppState }) {
  const { data: gens } = useAsync<AudioGeneration[]>(() => api.listGenerations(200), []);
  const u = state.usage;
  const monthGens = (gens ?? []).filter((g) => new Date(g.created_at).getMonth() === new Date().getMonth());
  const byEvent = topCounts(monthGens, 'event_type');

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="card">
        <div className="card-header"><span className="card-title">Uso do mês</span></div>
        <div className="space-y-4 p-5">
          <Bar used={u.audios_used} limit={u.audios_limit} label="Áudios" />
          <Bar used={u.characters_used} limit={u.characters_limit} label="Caracteres" />
          <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
            <span className="text-ink-600">Custo estimado (mês)</span>
            <span className="font-semibold text-ink-900">US$ {u.estimated_cost}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Eventos mais usados</span></div>
        <div className="p-5">
          {byEvent.length ? (
            <ul className="space-y-2">
              {byEvent.map(([ev, n]) => (
                <li key={ev} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{ev}</span>
                  <span className="text-ink-400">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem dados no mês" />
          )}
        </div>
      </div>
    </div>
  );
}
