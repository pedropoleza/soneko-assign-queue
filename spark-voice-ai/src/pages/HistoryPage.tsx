import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';
import type { AudioGeneration } from '@/types';

const statusTone: Record<string, 'green' | 'red' | 'amber'> = {
  completed: 'green',
  failed: 'red',
  processing: 'amber',
};

export function HistoryPage() {
  const { data, loading } = useAsync<AudioGeneration[]>(() => api.listGenerations(100), []);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Histórico de áudios</span>
        {data && <span className="text-xs text-ink-400">{data.length} gerações</span>}
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-5"><div className="h-40 animate-pulse rounded-lg bg-ink-100" /></div>
        ) : data?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Evento</th>
                <th className="px-4 py-2.5 font-medium">Texto final</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Carac.</th>
                <th className="px-4 py-2.5 font-medium">Custo</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Áudio</th>
              </tr>
            </thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink-800">{g.contact_name ?? '—'}{g.is_test && <span className="ml-1 text-[10px] text-brand-500">(teste)</span>}</td>
                  <td className="px-4 py-2.5 text-ink-600">{g.event_type ?? '—'}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-500" title={g.final_text}>{g.final_text}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone[g.status] ?? 'ink'}>{g.status}</Badge></td>
                  <td className="px-4 py-2.5 text-ink-500">{g.characters_used ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-500">{g.estimated_cost != null ? `US$ ${g.estimated_cost}` : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{formatDateTime(g.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {g.audio_url ? (
                      <a href={g.audio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <span className="text-ink-300" title={g.error_message ?? ''}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="Sem gerações" hint="Os áudios gerados pelo webhook e pelos testes aparecem aqui." />
        )}
      </div>
    </div>
  );
}
