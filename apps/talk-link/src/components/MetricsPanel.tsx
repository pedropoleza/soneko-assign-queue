import { MousePointerClick, Send, Target, Users } from 'lucide-react';
import type { AppState } from '@/types';
import { placementLabel } from '@/lib/trackingUrl';
import { pct, relativeTime } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState } from './ui';
import { DailyChart, RankBar, StatCard } from './Stats';

export function MetricsPanel({ state }: { state: AppState }) {
  const t = state.totals;
  const bySrc = state.sources?.by_src ?? [];
  const byContent = (state.sources?.by_content ?? []).filter((c) => c.content !== '—');
  const maxSrc = Math.max(1, ...bySrc.map((s) => s.clicks));
  const topPartners = [...state.partners].sort((a, b) => b.sends - a.sends).slice(0, 8);
  const maxPartner = Math.max(1, ...topPartners.map((p) => p.clicks));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cliques"
          value={t.clicks}
          previous={t.clicks_prev}
          hint={`${t.unique_clicks} únicos`}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
        <StatCard
          label="Mensagens enviadas"
          value={t.sends}
          previous={t.sends_prev}
          hint="confirmadas no CRM"
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          label="Taxa de envio"
          value={pct(t.sends, t.clicks)}
          hint="clicou e mandou"
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Parceiros ativos"
          value={t.partners}
          hint={`${t.links} links`}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Cliques e envios por dia"
          subtitle={`Últimos ${state.window_days} dias${t.bots ? ` · ${t.bots} acessos de robô descartados` : ''}`}
        />
        <DailyChart series={state.series} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ranking de parceiros" subtitle="Ordenado por mensagens enviadas." />
          {topPartners.length === 0 ? (
            <EmptyState title="Sem parceiros" description="Gere o primeiro link para começar a medir." />
          ) : (
            <div className="divide-y divide-ink-100 pb-2">
              {topPartners.map((p) => (
                <div key={p.id} className="pt-2">
                  <div className="flex items-baseline justify-between px-5 text-xs">
                    <span className="truncate font-medium text-ink-900">{p.name}</span>
                    <span className="shrink-0 text-ink-500">
                      <span className="font-semibold text-brand-700">{p.sends}</span> envios ·{' '}
                      {pct(p.sends, p.clicks)}
                    </span>
                  </div>
                  <RankBar label="cliques" value={p.clicks} total={maxPartner} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Origem do clique"
            subtitle="Lido do parâmetro ?s= da própria URL — bio, story, grupo…"
          />
          {bySrc.length === 0 ? (
            <EmptyState
              title="Sem cliques no período"
              description="Compartilhe um link marcando onde ele foi postado para comparar canais."
            />
          ) : (
            <div className="pb-2 pt-1">
              {bySrc.map((s) => (
                <RankBar
                  key={s.src}
                  label={placementLabel(s.src)}
                  value={s.clicks}
                  total={maxSrc}
                  secondary={`· ${s.sends} envios`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {byContent.length > 0 && (
        <Card>
          <CardHeader title="Variações (A/B)" subtitle="Comparação por ?ct= — útil para testar criativos." />
          <div className="pb-2 pt-1">
            {byContent.map((c) => (
              <RankBar
                key={c.content}
                label={c.content}
                value={c.clicks}
                total={Math.max(1, ...byContent.map((x) => x.clicks))}
                secondary={`· ${c.sends} envios`}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Cliques recentes" subtitle="Os 25 últimos acessos humanos aos seus links." />
        {state.recent_clicks.length === 0 ? (
          <EmptyState title="Nenhum clique ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2.5 font-medium">Quando</th>
                  <th className="px-3 py-2.5 font-medium">Campanha</th>
                  <th className="px-3 py-2.5 font-medium">Parceiro</th>
                  <th className="px-3 py-2.5 font-medium">Dispositivo</th>
                  <th className="px-5 py-2.5 font-medium">Enviou?</th>
                </tr>
              </thead>
              <tbody>
                {state.recent_clicks.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-2.5 text-xs text-ink-500">{relativeTime(c.clicked_at)}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-800">{c.link_name}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-600">{c.partner_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs capitalize text-ink-600">{c.device ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      {c.converted ? <Badge tone="brand">enviou</Badge> : <Badge>só clicou</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
