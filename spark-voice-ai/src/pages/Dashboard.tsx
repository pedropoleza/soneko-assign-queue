import { Mic, FileText, AudioLines, AlertTriangle } from 'lucide-react';
import type { AppState } from '@/types';
import { formatDateTime, pct } from '@/lib/utils';

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

export function Dashboard({ state }: { state: AppState }) {
  const u = state.usage;
  const audiosLeft = Math.max(0, u.audios_limit - u.audios_used);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<AudioLines size={15} />}
          label="Áudios este mês"
          value={`${u.audios_used}/${u.audios_limit}`}
          hint={`${audiosLeft} restantes`}
        />
        <StatCard
          icon={<FileText size={15} />}
          label="Caracteres"
          value={u.characters_used.toLocaleString('pt-BR')}
          hint={`limite ${u.characters_limit.toLocaleString('pt-BR')} · ${pct(u.characters_used, u.characters_limit)}%`}
        />
        <StatCard
          icon={<Mic size={15} />}
          label="Voz ativa"
          value={state.active_voice ? state.active_voice.voice_name : '—'}
          hint={state.active_voice ? state.active_voice.language : 'nenhuma voz cadastrada'}
        />
        <StatCard
          icon={<FileText size={15} />}
          label="Templates ativos"
          value={String(state.templates_active)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Último áudio</span></div>
          <div className="p-5 text-sm text-ink-600">
            {state.last_generation ? (
              <div className="space-y-1">
                <div className="font-medium text-ink-900">{state.last_generation.contact_name ?? '—'}</div>
                <div className="text-ink-500">
                  {state.last_generation.event_type} · {state.last_generation.status} ·{' '}
                  {formatDateTime(state.last_generation.created_at)}
                </div>
              </div>
            ) : (
              <span className="text-ink-400">Nenhuma geração ainda.</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" /> Erros recentes
            </span>
          </div>
          <div className="p-5 text-sm">
            {state.recent_errors.length ? (
              <ul className="space-y-2">
                {state.recent_errors.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 text-ink-600">
                    <span className="truncate">{e.error_message ?? 'erro'}</span>
                    <span className="shrink-0 text-ink-400">{formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-400">Sem erros no período.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
