import { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, FolderOpen, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppState, Link } from '@/types';
import { placementLabel } from '@/lib/trackingUrl';
import { copyToClipboard, pct, relativeTime } from '@/lib/utils';
import { BigStat, DayBars, RankRow, Ring } from './Stats';
import { Avatar, Button, Chip, Empty, Tag } from './ui';

type View = 'pastas' | 'links' | 'origens';

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
  onOpenPartner,
}: {
  state: AppState;
  onRefresh: () => void;
  onOpenLink: (id: string) => void;
  onOpenPartner: (id: string) => void;
}) {
  const [view, setView] = useState<View>('pastas');
  const [copied, setCopied] = useState<string | null>(null);

  const t = state.totals;
  const links = useMemo(
    () => [...state.links].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks),
    [state.links],
  );
  const partners = useMemo(
    () => [...state.partners].sort((a, b) => b.sends - a.sends || b.clicks - a.clicks),
    [state.partners],
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
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <BigStat value={t.clicks} label="Clicaram" sub={`${t.unique_clicks} pessoas`} />
        <BigStat value={t.sends} label="Mandaram mensagem" sub="confirmado no CRM" tone="accent" />
        <BigStat value={pct(t.sends, t.clicks)} label="Viraram conversa" sub={`nos últimos ${state.window_days} dias`} />
      </div>

      <div className="card">
        <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
          <h2 className="text-sm font-semibold text-ink">Movimento por dia</h2>
          {t.bots > 0 && <span className="text-[11px] text-ink-3">{t.bots} acessos de robô descartados</span>}
        </div>
        <DayBars series={state.series} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3.5">
          {(
            [
              ['pastas', `Influenciadores (${partners.length})`],
              ['links', `Todos os links (${links.length})`],
              ['origens', 'Onde foi postado'],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} on={view === id} onClick={() => setView(id)}>
              {label}
            </Chip>
          ))}
        </div>

        {/* Pastas: um influenciador por linha, com o que ele já rendeu. */}
        {view === 'pastas' &&
          (partners.length === 0 ? (
            <Empty title="Nenhum influenciador ainda" description="Ele é criado junto com o primeiro link." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {partners.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onOpenPartner(p.id)}
                    className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition hover:bg-surface-2"
                  >
                    <Avatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium text-ink">{p.name}</div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        {p.links} {p.links === 1 ? 'link' : 'links'} · {p.clicks} cliques
                      </div>
                    </div>
                    <div className="num shrink-0 text-right">
                      <div className="text-lg font-semibold leading-none text-ink">{p.sends}</div>
                      <div className="mt-1 text-[11px] text-ink-3">mandaram</div>
                    </div>
                    <Ring part={p.sends} total={p.clicks} size={38} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {view === 'links' && (
          <ul className="divide-y divide-line border-t border-line">
            {links.map((l) => (
              <li key={l.id} className="group flex items-center gap-3.5 px-5 py-4 transition hover:bg-surface-2">
                <Ring part={l.sends} total={l.clicks} size={38} />
                <button onClick={() => onOpenLink(l.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="truncate text-[15px] font-medium text-ink">{l.name}</span>
                    {l.partner_name && <Tag tone="accent">{l.partner_name}</Tag>}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-ink-3">
                    /{l.slug} ·{' '}
                    {l.last_click_at ? `último clique ${relativeTime(l.last_click_at)}` : 'sem cliques ainda'}
                  </div>
                </button>
                <div className="num shrink-0 text-right">
                  <div className="text-lg font-semibold leading-none text-ink">{l.sends}</div>
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

        {view === 'origens' &&
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
      </div>

      <div className="card overflow-hidden">
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
          <ul className="divide-y divide-line border-t border-line">
            {state.recent_sends.slice(0, 10).map((s) => (
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
