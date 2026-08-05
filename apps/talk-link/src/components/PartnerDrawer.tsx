import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { MonthPoint, PartnerDetail } from '@/types';
import { copyToClipboard, relativeTime } from '@/lib/utils';
import { MonthBars, Ring } from './Stats';
import { Avatar, Empty, Skeleton } from './ui';

const KIND_LABEL: Record<string, string> = {
  influencer: 'Influenciador',
  store: 'Loja',
  partner: 'Parceiro',
  other: 'Outro',
};

function monthLabel(m: string) {
  return new Date(`${m}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

/**
 * A pasta do influenciador: tudo o que ele tem, junto.
 * Total da pasta, evolução mês a mês e cada link com o próprio desempenho.
 */
export function PartnerDrawer({
  partnerId,
  onClose,
  onOpenLink,
}: {
  partnerId: string | null;
  onClose: () => void;
  onOpenLink: (id: string) => void;
}) {
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId) return setData(null);
    setLoading(true);
    api
      .partnerDetail(partnerId, 6)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [partnerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!partnerId) return null;

  async function copy(url: string, id: string) {
    if (!(await copyToClipboard(url))) return toast.error('Não consegui copiar.');
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
    toast.success('Link copiado');
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-paper">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper/90 px-5 py-4 backdrop-blur">
          {data && <Avatar name={data.partner.name} size="lg" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-ink">
              {data?.partner.name ?? 'Carregando…'}
            </h2>
            {data && (
              <p className="mt-0.5 text-[12px] text-ink-3">
                {KIND_LABEL[data.partner.kind] ?? data.partner.kind}
                {data.partner.handle ? ` · ${data.partner.handle}` : ''} · {data.totals.links}{' '}
                {data.totals.links === 1 ? 'link' : 'links'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {loading || !data ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="card flex items-center gap-5 px-5 py-4">
              <Ring part={data.totals.sends} total={data.totals.clicks} size={54} />
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div>
                  <div className="num text-[26px] font-semibold leading-none text-ink">
                    {data.totals.clicks}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-2">clicaram</div>
                </div>
                <div>
                  <div className="num text-[26px] font-semibold leading-none text-accent">
                    {data.totals.sends}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-2">mandaram mensagem</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="px-5 pb-1 pt-4 text-sm font-semibold text-ink">Mês a mês</h3>
              <MonthBars months={data.by_month} />
            </div>

            <div className="card overflow-hidden">
              <h3 className="px-5 pb-3 pt-4 text-sm font-semibold text-ink">
                Links desta pasta ({data.links.length})
              </h3>

              {data.links.length === 0 ? (
                <Empty title="Nenhum link ainda" description="Crie o primeiro link para este influenciador." />
              ) : (
                <ul className="divide-y divide-line">
                  {data.links.map((l) => (
                    <li key={l.id} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Ring part={l.sends} total={l.clicks} size={38} />
                        <button onClick={() => onOpenLink(l.id)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-medium text-ink">{l.name}</div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-ink-3">/{l.slug}</div>
                        </button>
                        <div className="num shrink-0 text-right">
                          <div className="text-base font-semibold leading-none text-ink">
                            {l.sends}
                            <span className="ml-1 text-[12px] font-normal text-ink-3">de {l.clicks}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-ink-3">
                            {l.last_click_at ? relativeTime(l.last_click_at) : 'sem cliques'}
                          </div>
                        </div>
                        <button
                          onClick={() => copy(l.short_url, l.id)}
                          title="Copiar link"
                          className="rounded-full p-2 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
                        >
                          {copied === l.id ? (
                            <Check className="h-4 w-4 text-accent" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <MonthStrip months={l.by_month} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Faixa mensal compacta de um link, dentro da linha da pasta. */
function MonthStrip({ months }: { months: MonthPoint[] }) {
  const max = Math.max(1, ...months.map((m) => m.clicks));
  return (
    <div className="mt-3 flex items-end gap-1.5 pl-[50px]">
      {months.map((m) => (
        <div key={m.month} className="flex-1 text-center" title={`${m.clicks} cliques · ${m.sends} enviaram`}>
          <div className="flex h-8 items-end">
            <div
              className="relative w-full overflow-hidden rounded bg-accent/15"
              style={{ height: `${Math.max(8, (m.clicks / max) * 100)}%` }}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded bg-accent"
                style={{ height: `${m.clicks ? (m.sends / m.clicks) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="mt-1 text-[10px] text-ink-3">{monthLabel(m.month)}</div>
        </div>
      ))}
    </div>
  );
}
