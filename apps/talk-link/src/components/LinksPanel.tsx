import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppState, Link } from '@/types';
import { copyToClipboard, formatPhone, pct, relativeTime } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState, Input } from './ui';

export function LinksPanel({
  state,
  onRefresh,
  onOpenDetail,
}: {
  state: AppState;
  onRefresh: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const links = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...state.links].sort((a, b) => b.clicks - a.clicks || (a.name > b.name ? 1 : -1));
    if (!q) return list;
    return list.filter((l) =>
      [l.name, l.slug, l.partner_name ?? '', l.code].some((v) => v.toLowerCase().includes(q)),
    );
  }, [state.links, query]);

  async function copy(link: Link) {
    const ok = await copyToClipboard(link.short_url);
    if (!ok) return toast.error('Não consegui copiar.');
    setCopied(link.id);
    setTimeout(() => setCopied(null), 1600);
    toast.success('Link copiado');
  }

  async function remove(link: Link) {
    if (!confirm(`Arquivar o link "${link.name}"? Ele para de redirecionar, mas o histórico continua.`)) return;
    try {
      await api.deleteLink(link.id);
      toast.success('Link arquivado');
      onRefresh();
    } catch (e) {
      toast.error(`Não deu para arquivar: ${String(e)}`);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Links ativos"
        subtitle={`${state.links.length} link${state.links.length === 1 ? '' : 's'} · janela de ${state.window_days} dias`}
        action={
          <div className="relative w-48 sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por parceiro, campanha…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
      />

      {links.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title={query ? 'Nenhum link encontrado' : 'Nenhum link gerado ainda'}
          description={
            query
              ? 'Tente outro termo de busca.'
              : 'Vá em “Gerar link”, escolha o influenciador e crie a primeira campanha.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2.5 font-medium">Campanha</th>
                <th className="px-3 py-2.5 font-medium">Destino</th>
                <th className="px-3 py-2.5 text-right font-medium">Cliques</th>
                <th className="px-3 py-2.5 text-right font-medium">Envios</th>
                <th className="px-3 py-2.5 text-right font-medium">Conversão</th>
                <th className="px-3 py-2.5 font-medium">Último</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="table-row">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => onOpenDetail(l.id)}
                      className="block max-w-[260px] truncate text-left font-medium text-ink-900 hover:text-brand-700"
                    >
                      {l.name}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="truncate font-mono text-[11px] text-ink-400">/{l.slug}</span>
                      {l.partner_name && <Badge>{l.partner_name}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-600">{formatPhone(l.destination_phone)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-900">{l.clicks}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-brand-700">{l.sends}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{pct(l.sends, l.clicks)}</td>
                  <td className="px-3 py-3 text-xs text-ink-500">{relativeTime(l.last_click_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => copy(l)}
                        title="Copiar link"
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      >
                        {copied === l.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={l.short_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir"
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => remove(l)}
                        title="Arquivar"
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function RecentSends({ state }: { state: AppState }) {
  const MATCH_LABEL: Record<string, string> = {
    invisible_code: 'marcador invisível',
    code: 'código na mensagem',
    fingerprint: 'texto idêntico',
    prefix: 'texto com acréscimo',
    head40: 'início do texto',
    manual: 'manual',
  };

  return (
    <Card>
      <CardHeader title="Últimos envios confirmados" subtitle="Quem clicou e realmente mandou a mensagem." />
      {state.recent_sends.length === 0 ? (
        <EmptyState
          title="Nenhum envio confirmado ainda"
          description="Assim que alguém clicar no link e mandar a mensagem, ela aparece aqui — e a origem vai para o CRM."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {state.recent_sends.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm font-medium text-ink-900">{s.contact_name ?? 'Contato'}</span>
                  <span className="text-[11px] text-ink-400">{relativeTime(s.occurred_at)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {s.partner_name && <Badge tone="brand">{s.partner_name}</Badge>}
                  {s.link_name && <Badge>{s.link_name}</Badge>}
                  <Badge tone={s.confidence >= 0.95 ? 'neutral' : 'warn'}>
                    {MATCH_LABEL[s.matched_by] ?? s.matched_by}
                  </Badge>
                  {!s.crm_synced && <Badge tone="warn">CRM pendente</Badge>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
