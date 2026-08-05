import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import type { LinkDetail } from '@/types';
import { formatDateTime, pct, relativeTime } from '@/lib/utils';
import { appLabel } from '@/lib/trackingUrl';
import { DayBars, Ring } from './Stats';
import { Empty, Skeleton, Tag } from './ui';

const MATCH_LABEL: Record<string, string> = {
  invisible_code: 'confirmado pelo código',
  code: 'confirmado pelo código',
  fingerprint: 'texto idêntico',
  prefix: 'texto com acréscimo',
  head40: 'início do texto',
  manual: 'marcado à mão',
};

export function LinkDetailDrawer({ linkId, onClose }: { linkId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<LinkDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!linkId) return setDetail(null);
    setLoading(true);
    api
      .linkDetail(linkId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [linkId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!linkId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-paper shadow-lift">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-paper/90 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">
              {detail?.link.name ?? 'Carregando…'}
            </h2>
            {detail && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {detail.link.partner_name && <Tag tone="accent">{detail.link.partner_name}</Tag>}
                <span className="truncate font-mono text-[11px] text-ink-3">/{detail.link.slug}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {loading || !detail ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="card flex items-center gap-5 px-5 py-4">
              <Ring part={detail.link.sends} total={detail.link.clicks} size={56} />
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div>
                  <div className="num text-2xl font-semibold leading-none text-ink">{detail.link.clicks}</div>
                  <div className="mt-1 text-[12px] text-ink-2">clicaram</div>
                </div>
                <div>
                  <div className="num text-2xl font-semibold leading-none text-accent-deep">
                    {detail.link.sends}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-2">
                    mandaram · {pct(detail.link.sends, detail.link.clicks)}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="px-5 pb-1 pt-4 text-sm font-semibold text-ink">Movimento por dia</h3>
              <DayBars series={detail.series} />
            </div>

            <div className="card overflow-hidden">
              <h3 className="px-5 pb-3 pt-4 text-sm font-semibold text-ink">
                Quem mandou mensagem ({detail.sends.length})
              </h3>
              {detail.sends.length === 0 ? (
                <Empty
                  title="Ninguém enviou ainda"
                  description="Os cliques chegaram, mas nenhuma mensagem foi confirmada até agora."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {detail.sends.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-deep">
                        {(s.contact_name ?? '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {s.contact_name ?? 'Contato'}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                          <span>{MATCH_LABEL[s.matched_by] ?? s.matched_by}</span>
                          {!s.crm_synced && <Tag tone="warn">CRM pendente</Tag>}
                        </div>
                      </div>
                      <span className="shrink-0 text-[12px] text-ink-3">{formatDateTime(s.occurred_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card overflow-hidden">
              <h3 className="px-5 pb-3 pt-4 text-sm font-semibold text-ink">
                Cliques ({detail.clicks.length})
              </h3>
              <ul className="divide-y divide-line">
                {detail.clicks.slice(0, 30).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="text-[13px] text-ink-2">
                      {relativeTime(c.clicked_at)}
                      <span className="ml-2 text-[12px] capitalize text-ink-3">
                        {[
                          c.device,
                          appLabel(c.app),
                          [c.city, c.country].filter(Boolean).join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {c.converted_at ? <Tag tone="accent">mandou</Tag> : <Tag>só clicou</Tag>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
