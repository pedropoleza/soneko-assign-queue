import { useState } from 'react';
import { AlertTriangle, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import type { Signals } from '@/types';
import { relativeTime } from '@/lib/utils';
import { Chip, Empty, Tag } from './ui';

/**
 * O que o relatório não contava.
 *
 * O painel principal mostra volume — quanto entrou no período. Volume responde
 * "como foi", e não responde três perguntas que decidem ação:
 *
 *   Avisos    — que link está no ar e parou de receber gente?
 *   Qualidade — esse clique é gente ou é a mesma pessoa recarregando?
 *   Evolução  — quem melhorou? (ranking por tamanho sempre premia quem já é grande)
 */
type Panel = 'alerts' | 'quality' | 'trend';

const ALERT_TEXT: Record<string, (a: Signals['alerts'][number]) => string> = {
  sem_entrada: (a) =>
    `Sem nenhum clique novo há ${a.days_quiet} dias. O link continua no ar.`,
  nunca_clicado: () => 'Nunca recebeu um clique desde que foi criado.',
  sem_envio: (a) =>
    `${a.clicks_window} cliques no período e nenhuma mensagem. Vale olhar a mensagem e o número.`,
};

function pctLabel(v: number | null): string | null {
  if (v === null) return null;
  return `${v > 0 ? '+' : ''}${v}%`;
}

export function SignalsCard({
  signals,
  onOpenLink,
  onOpenPartner,
}: {
  signals: Signals;
  onOpenLink: (id: string) => void;
  onOpenPartner: (id: string) => void;
}) {
  const alerts = signals.alerts ?? [];
  const quality = signals.quality ?? [];
  const trend = signals.trend ?? [];

  // Abre já no que pede ação: se há aviso, começa por ele.
  const [panel, setPanel] = useState<Panel>(alerts.length ? 'alerts' : 'trend');

  const suspects = quality.filter((q) => q.suspect);
  const movers = trend.filter((t) => t.delta_sends !== 0 || t.delta_clicks !== 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3.5">
        <Chip on={panel === 'alerts'} onClick={() => setPanel('alerts')}>
          Avisos{alerts.length ? ` (${alerts.length})` : ''}
        </Chip>
        <Chip on={panel === 'quality'} onClick={() => setPanel('quality')}>
          Qualidade do clique{suspects.length ? ` (${suspects.length})` : ''}
        </Chip>
        <Chip on={panel === 'trend'} onClick={() => setPanel('trend')}>
          Quem evoluiu
        </Chip>
      </div>

      {panel === 'alerts' &&
        (alerts.length === 0 ? (
          <Empty
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Nenhum link parado"
            description={`Todo link ativo recebeu gente nos últimos ${signals.stale_days} dias.`}
          />
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <li key={`${a.link_id}-${a.kind}`}>
                <button
                  type="button"
                  onClick={() => onOpenLink(a.link_id)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-surface-2"
                >
                  <AlertTriangle
                    className={
                      a.kind === 'sem_envio'
                        ? 'mt-0.5 h-4 w-4 shrink-0 text-ink-3'
                        : 'mt-0.5 h-4 w-4 shrink-0 text-warn'
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{a.link_name}</span>
                      {a.partner_name && (
                        <span className="text-[12px] text-ink-3">{a.partner_name}</span>
                      )}
                      {a.kind === 'sem_envio' ? (
                        <Tag>só clique</Tag>
                      ) : (
                        <Tag tone="warn">parado</Tag>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-2">
                      {(ALERT_TEXT[a.kind] ?? (() => ''))(a)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {panel === 'quality' &&
        (quality.length === 0 ? (
          <Empty
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Ainda sem cliques para avaliar"
            description="A leitura aparece assim que os links começarem a receber gente."
          />
        ) : (
          <>
            <p className="px-5 pt-1 text-[12px] text-ink-3">
              Concentração é quanto do clique veio do mesmo aparelho. Perto de 100% costuma ser a
              mesma pessoa recarregando — importa quando o parceiro é pago por clique.
            </p>
            <ul className="mt-2 divide-y divide-line">
              {quality.map((q) => (
                <li key={q.link_id}>
                  <button
                    type="button"
                    onClick={() => onOpenLink(q.link_id)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm text-ink">{q.link_name}</span>
                        {q.suspect && <Tag tone="danger">concentrado</Tag>}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        {q.clicks} cliques · {q.uniques} aparelhos
                        {q.no_ip > 0 && ` · ${q.no_ip} sem origem`}
                      </span>
                    </span>
                    <span
                      className={
                        q.suspect
                          ? 'shrink-0 text-sm font-semibold text-danger'
                          : 'shrink-0 text-sm text-ink-2'
                      }
                    >
                      {q.concentration === null ? '—' : `${Math.round(q.concentration * 100)}%`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ))}

      {panel === 'trend' &&
        (movers.length === 0 ? (
          <Empty
            icon={<TrendingUp className="h-5 w-5" />}
            title="Ainda não dá para comparar"
            description="A evolução aparece quando houver movimento no período anterior."
          />
        ) : (
          <>
            <p className="px-5 pt-1 text-[12px] text-ink-3">
              Comparação com os {signals.window_days} dias anteriores. Aqui o ranking é por
              variação, não por tamanho.
            </p>
            <ul className="mt-2 divide-y divide-line">
              {movers.map((t) => {
                const up = t.delta_sends > 0 || (t.delta_sends === 0 && t.delta_clicks > 0);
                const pct = pctLabel(t.pct_sends);
                return (
                  <li key={t.partner_id}>
                    <button
                      type="button"
                      onClick={() => onOpenPartner(t.partner_id)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-2"
                    >
                      {up ? (
                        <TrendingUp className="h-4 w-4 shrink-0 text-accent-deep" />
                      ) : (
                        <TrendingDown className="h-4 w-4 shrink-0 text-danger" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="truncate text-sm text-ink">{t.partner_name}</span>
                        <span className="mt-0.5 block text-[12px] text-ink-3">
                          {t.sends} mensagens (antes {t.sends_prev}) · {t.clicks} cliques (antes{' '}
                          {t.clicks_prev})
                        </span>
                      </span>
                      <span
                        className={
                          up
                            ? 'shrink-0 text-sm font-semibold text-accent-deep'
                            : 'shrink-0 text-sm font-semibold text-danger'
                        }
                      >
                        {/* Sem base anterior não existe percentual honesto — mostra o absoluto. */}
                        {pct ?? `${t.delta_sends > 0 ? '+' : ''}${t.delta_sends}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ))}
    </div>
  );
}

/** Faixa curta no topo do relatório: só aparece quando há link parado. */
export function AlertStrip({
  signals,
  onOpenLink,
}: {
  signals: Signals;
  onOpenLink: (id: string) => void;
}) {
  const parados = (signals.alerts ?? []).filter((a) => a.kind !== 'sem_envio');
  if (!parados.length) return null;
  const first = parados[0];

  return (
    <button
      type="button"
      onClick={() => onOpenLink(first.link_id)}
      className="card flex w-full items-center gap-3 border-warn/30 bg-warn-soft/40 px-5 py-3 text-left transition hover:bg-warn-soft/60"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
      <span className="min-w-0 flex-1 text-[13px] text-ink">
        {parados.length === 1 ? (
          <>
            <strong className="font-semibold">{first.link_name}</strong> está no ar e não recebe
            ninguém{' '}
            {first.days_quiet === null
              ? 'desde que foi criado'
              : `há ${first.days_quiet} dias`}
            .
          </>
        ) : (
          <>
            <strong className="font-semibold">{parados.length} links</strong> estão no ar e pararam
            de receber gente.
          </>
        )}
      </span>
      {first.last_click_at && (
        <span className="shrink-0 text-[12px] text-ink-3">
          último {relativeTime(first.last_click_at)}
        </span>
      )}
    </button>
  );
}
