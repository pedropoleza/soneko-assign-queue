import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import type { LinkDetail } from '@/types';
import { formatDateTime, pct, relativeTime } from '@/lib/utils';
import { Badge, EmptyState, Skeleton } from './ui';
import { DailyChart, RankBar } from './Stats';

const MATCH_LABEL: Record<string, string> = {
  invisible_code: 'marcador invisível',
  code: 'código na mensagem',
  fingerprint: 'texto idêntico',
  prefix: 'texto com acréscimo',
  head40: 'início do texto',
  manual: 'manual',
};

export function LinkDetailDrawer({ linkId, onClose }: { linkId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<LinkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'sends' | 'clicks'>('sends');

  useEffect(() => {
    if (!linkId) {
      setDetail(null);
      return;
    }
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

  const maxDevice = Math.max(1, ...(detail?.by_device ?? []).map((d) => d.count));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink-900">
              {detail?.link.name ?? 'Carregando…'}
            </h2>
            {detail && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] text-ink-400">/{detail.link.slug}</span>
                {detail.link.partner_name && <Badge tone="brand">{detail.link.partner_name}</Badge>}
                <Badge>código {detail.link.code}</Badge>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {loading || !detail ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-ink-200 p-3">
                <div className="text-[11px] text-ink-500">Cliques</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">{detail.link.clicks}</div>
              </div>
              <div className="rounded-lg border border-ink-200 p-3">
                <div className="text-[11px] text-ink-500">Envios</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{detail.link.sends}</div>
              </div>
              <div className="rounded-lg border border-ink-200 p-3">
                <div className="text-[11px] text-ink-500">Conversão</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">
                  {pct(detail.link.sends, detail.link.clicks)}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Evolução</span>
              </div>
              <DailyChart series={detail.series} />
            </div>

            {detail.by_device.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Dispositivos</span>
                </div>
                <div className="pb-2 pt-1">
                  {detail.by_device.map((d) => (
                    <RankBar key={d.device} label={d.device} value={d.count} total={maxDevice} />
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex gap-1 border-b border-ink-100 px-3 py-2">
                {(
                  [
                    ['sends', `Envios (${detail.sends.length})`],
                    ['clicks', `Cliques (${detail.clicks.length})`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'sends' ? (
                detail.sends.length === 0 ? (
                  <EmptyState title="Nenhum envio confirmado" description="Os cliques ainda não viraram mensagem." />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {detail.sends.map((s) => (
                      <li key={s.id} className="px-5 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink-900">
                            {s.contact_name ?? 'Contato'}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-400">
                            {formatDateTime(s.occurred_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={s.confidence >= 0.95 ? 'neutral' : 'warn'}>
                            {MATCH_LABEL[s.matched_by] ?? s.matched_by}
                          </Badge>
                          {s.crm_synced ? <Badge tone="brand">no CRM</Badge> : <Badge tone="warn">CRM pendente</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : detail.clicks.length === 0 ? (
                <EmptyState title="Nenhum clique" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {detail.clicks.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <span className="text-xs text-ink-700">{relativeTime(c.clicked_at)}</span>
                        <span className="ml-2 text-[11px] capitalize text-ink-400">
                          {[c.device, c.os, c.city].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </div>
                      {c.converted_at ? <Badge tone="brand">enviou</Badge> : <Badge>só clicou</Badge>}
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
