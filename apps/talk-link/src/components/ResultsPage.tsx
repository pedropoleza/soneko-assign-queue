import { useMemo, useState } from 'react';
import { Check, Copy, LineChart, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppState, Link } from '@/types';
import { placementLabel } from '@/lib/trackingUrl';
import { copyToClipboard, pct, relativeTime } from '@/lib/utils';
import { BigStat, DayBars, RankRow, Ring } from './Stats';
import { Button, Chip, Empty, Tag } from './ui';

type View = 'campanhas' | 'parceiros' | 'origens';

const MATCH_LABEL: Record<string, string> = {
  invisible_code: 'confirmado pelo código',
  code: 'confirmado pelo código',
  fingerprint: 'texto idêntico',
  prefix: 'texto com acréscimo',
  head40: 'início do texto',
  manual: 'marcado à mão',
};

export function ResultsPage({
  state,
  onRefresh,
  onOpenLink,
}: {
  state: AppState;
  onRefresh: () => void;
  onOpenLink: (id: string) => void;
}) {
  const [view, setView] = useState<View>('campanhas');
  const [copied, setCopied] = useState<string | null>(null);

  const t = state.totals;
  const links = useMemo(() => [...state.links].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks), [state.links]);
  const partners = useMemo(
    () => [...state.partners].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks),
    [state.partners],
  );
  const sources = state.sources?.by_src ?? [];

  const maxPartner = Math.max(1, ...partners.map((p) => p.clicks));
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
        icon={<LineChart className="h-5 w-5" />}
        title="Ainda não há nada para medir"
        description="Crie o primeiro link e os cliques e envios começam a aparecer aqui na hora."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Resultados</h1>
        <p className="mt-1 text-sm text-ink-2">Últimos {state.window_days} dias.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <BigStat value={t.clicks} label="Clicaram no link" sub={`${t.unique_clicks} pessoas diferentes`} />
        <BigStat value={t.sends} label="Mandaram mensagem" sub="confirmado no CRM" tone="accent" />
        <div className="col-span-2 sm:col-span-1">
          <BigStat value={pct(t.sends, t.clicks)} label="Viraram conversa" sub="de cada 100 que clicaram" />
        </div>
      </div>

      <div className="surface shadow-card">
        <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
          <h2 className="text-sm font-semibold text-ink">Movimento por dia</h2>
          {t.bots > 0 && <span className="text-[11px] text-ink-3">{t.bots} acessos de robô descartados</span>}
        </div>
        <DayBars series={state.series} />
      </div>

      <div className="surface overflow-hidden shadow-card">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-3">
          {(
            [
              ['campanhas', `Campanhas (${links.length})`],
              ['parceiros', `Parceiros (${partners.length})`],
              ['origens', 'Onde foi postado'],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} on={view === id} onClick={() => setView(id)} className="px-3 py-1.5 text-[13px]">
              {label}
            </Chip>
          ))}
        </div>

        {view === 'campanhas' && (
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.id} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2">
                <Ring part={l.sends} total={l.clicks} />

                <button onClick={() => onOpenLink(l.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="truncate text-[15px] font-semibold text-ink">{l.name}</span>
                    {l.partner_name && <Tag tone="accent">{l.partner_name}</Tag>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                    <span className="truncate font-mono">/{l.slug}</span>
                    <span>·</span>
                    <span>{l.last_click_at ? `último clique ${relativeTime(l.last_click_at)}` : 'sem cliques ainda'}</span>
                  </div>
                </button>

                <div className="num shrink-0 text-right">
                  <div className="text-xl font-semibold leading-none text-accent-deep">{l.sends}</div>
                  <div className="mt-1 text-[11px] text-ink-3">de {l.clicks} cliques</div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => copy(l)}
                    title="Copiar link"
                    className="rounded-lg p-2 text-ink-3 transition hover:bg-surface hover:text-ink"
                  >
                    {copied === l.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => archive(l)}
                    title="Arquivar"
                    className="rounded-lg p-2 text-ink-3 opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {view === 'parceiros' && (
          <ul className="divide-y divide-line">
            {partners.map((p) => (
              <li key={p.id}>
                <RankRow
                  label={p.name}
                  meta={`${p.links} ${p.links === 1 ? 'campanha' : 'campanhas'}`}
                  clicks={p.clicks}
                  sends={p.sends}
                  max={maxPartner}
                />
              </li>
            ))}
          </ul>
        )}

        {view === 'origens' &&
          (sources.length === 0 ? (
            <Empty
              title="Nenhuma origem marcada ainda"
              description="Ao copiar um link, escolha onde vai postar (bio, story, grupo…). A comparação aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-line">
              {sources.map((s) => (
                <li key={s.src}>
                  <RankRow label={placementLabel(s.src)} clicks={s.clicks} sends={s.sends} max={maxSource} />
                </li>
              ))}
            </ul>
          ))}
      </div>

      <div className="surface overflow-hidden shadow-card">
        <div className="flex items-center gap-2 px-5 py-4">
          <Send className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Quem mandou mensagem</h2>
        </div>
        {state.recent_sends.length === 0 ? (
          <Empty
            title="Nenhuma mensagem ainda"
            description="Assim que alguém enviar, aparece aqui — e a origem já entra no contato do CRM."
          />
        ) : (
          <ul className="divide-y divide-line">
            {state.recent_sends.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-deep">
                  {(s.contact_name ?? '?').slice(0, 1).toUpperCase()}
                </span>
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
        )}
      </div>

      <div className="flex justify-center pb-4">
        <Button variant="quiet" size="sm" onClick={onRefresh}>
          Atualizar números
        </Button>
      </div>
    </div>
  );
}
