import { useMemo, useState } from 'react';
import { Check, Copy, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppState, Link } from '@/types';
import { placementLabel } from '@/lib/trackingUrl';
import { copyToClipboard, pct, relativeTime } from '@/lib/utils';
import { DayBars, RankRow, Ring } from './Stats';
import { InfluencersCard } from './InfluencersCard';
import { Avatar, Button, Chip, Empty, Tag } from './ui';

type Detail = 'links' | 'origens' | 'mensagens';

const MATCH_LABEL: Record<string, string> = {
  invisible_code: 'confirmado pelo código',
  code: 'confirmado pelo código',
  fingerprint: 'texto idêntico',
  prefix: 'texto com acréscimo',
  head40: 'início do texto',
  manual: 'marcado à mão',
};

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

export function ResultsPage({
  state,
  days,
  onChangeDays,
  onRefresh,
  onOpenLink,
  onOpenPartner,
}: {
  state: AppState;
  days: number;
  onChangeDays: (d: number) => void;
  onRefresh: () => void;
  onOpenLink: (id: string) => void;
  onOpenPartner: (id: string) => void;
}) {
  const [detail, setDetail] = useState<Detail>('links');
  const [copied, setCopied] = useState<string | null>(null);

  const t = state.totals;
  const links = useMemo(
    () => [...state.links].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks),
    [state.links],
  );
  const sources = state.sources?.by_src ?? [];
  const maxSource = Math.max(1, ...sources.map((s) => s.clicks));

  async function copy(l: Link) {
    if (!(await copyToClipboard(l.short_url))) return toast.error('Não consegui copiar.');
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1600);
    toast.success('Link copiado');
  }

  async function archive(l: Link) {
    if (!confirm(`Arquivar "${l.name}"? O link para de funcionar, mas os números ficam guardados.`)) return;
    try {
      await api.deleteLink(l.id);
      toast.success('Campanha arquivada');
      onRefresh();
    } catch (e) {
      toast.error(`Não deu para arquivar. ${String(e)}`);
    }
  }

  if (!state.links.length) {
    return (
      <Empty
        icon={<FolderOpen className="h-5 w-5" />}
        title="Ainda não há nada para medir"
        description="Crie o primeiro link e os cliques e envios começam a aparecer aqui na hora."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Uma faixa: os três números e o período, na mesma linha. */}
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <Figure value={t.clicks} label="clicaram" sub={`${t.unique_clicks} pessoas`} />
        <Figure value={t.sends} label="mandaram mensagem" sub="confirmado no CRM" accent />
        <Figure value={pct(t.sends, t.clicks)} label="viraram conversa" sub={`${t.links} links ativos`} />

        <div className="ml-auto flex gap-1.5">
          {PERIODS.map((p) => (
            <Chip
              key={p.days}
              on={days === p.days}
              onClick={() => onChangeDays(p.days)}
              className="px-3 py-1.5 text-[12px]"
            >
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
          <h2 className="text-sm font-semibold text-ink">Movimento por dia</h2>
          {t.bots > 0 && <span className="text-[11px] text-ink-3">{t.bots} acessos de robô descartados</span>}
        </div>
        <DayBars series={state.series} />
      </div>

      <InfluencersCard partners={state.partners} onOpen={onOpenPartner} />

      {/* O detalhe fica embaixo, num único cartão que troca de conteúdo. */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3.5">
          {(
            [
              ['links', `Links (${links.length})`],
              ['origens', 'Onde foi postado'],
              ['mensagens', `Mensagens (${state.recent_sends.length})`],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} on={detail === id} onClick={() => setDetail(id)}>
              {label}
            </Chip>
          ))}
        </div>

        {detail === 'links' && (
          <ul className="divide-y divide-line border-t border-line">
            {links.map((l) => (
              <li key={l.id} className="group flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2">
                <Ring part={l.sends} total={l.clicks} size={36} />
                <button onClick={() => onOpenLink(l.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-ink">{l.name}</span>
                    {l.partner_name && <Tag tone="accent">{l.partner_name}</Tag>}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-ink-3">
                    /{l.slug} ·{' '}
                    {l.last_click_at ? `último clique ${relativeTime(l.last_click_at)}` : 'sem cliques ainda'}
                  </div>
                </button>
                <div className="num shrink-0 text-right">
                  <div className="text-base font-semibold leading-none text-ink">{l.sends}</div>
                  <div className="mt-1 text-[11px] text-ink-3">de {l.clicks}</div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => copy(l)}
                    title="Copiar link"
                    className="rounded-full p-2 text-ink-3 transition hover:bg-line hover:text-ink"
                  >
                    {copied === l.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => archive(l)}
                    title="Arquivar"
                    className="rounded-full p-2 text-ink-3 opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {detail === 'origens' &&
          (sources.length === 0 ? (
            <Empty
              title="Nenhuma origem marcada ainda"
              description="Ao copiar um link, escolha onde vai postar (bio, story, grupo…). A comparação aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {sources.map((s) => (
                <li key={s.src}>
                  <RankRow label={placementLabel(s.src)} clicks={s.clicks} sends={s.sends} max={maxSource} />
                </li>
              ))}
            </ul>
          ))}

        {detail === 'mensagens' &&
          (state.recent_sends.length === 0 ? (
            <Empty
              title="Nenhuma mensagem ainda"
              description="Assim que alguém enviar, aparece aqui — e a origem já entra no contato do CRM."
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {state.recent_sends.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={s.contact_name ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{s.contact_name ?? 'Contato'}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                      {s.partner_name && <Tag tone="accent">{s.partner_name}</Tag>}
                      <span>{MATCH_LABEL[s.matched_by] ?? s.matched_by}</span>
                      {!s.crm_synced && <Tag tone="warn">CRM pendente</Tag>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-ink-3">{relativeTime(s.occurred_at)}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>

      <div className="flex justify-center pb-4">
        <Button variant="quiet" size="sm" onClick={onRefresh}>
          Atualizar números
        </Button>
      </div>
    </div>
  );
}

function Figure({
  value,
  label,
  sub,
  accent,
}: {
  value: string | number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className={`num text-[28px] font-semibold leading-none ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[13px] font-medium text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
