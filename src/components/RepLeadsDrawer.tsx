import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { CheckCircle2, Clock, ExternalLink, Loader2, Search, SkipForward, X, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { cn, formatAdaptive, formatRelative } from '@/lib/utils';

type Item = {
  id: string; ghl_contact_id: string;
  contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; contact_source: string | null;
  contact_tags: string[] | null;
  was_skipped: boolean; ghl_sync_status: string; ghl_sync_error: string | null;
  created_at: string;
};

export function RepLeadsDrawer({
  open, onClose, rep, startISO, endISO,
}: {
  open: boolean;
  onClose: () => void;
  rep: { rep_id: string; name: string; avatar_url: string | null; total: number } | null;
  startISO: string;
  endISO: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'skipped' | 'failed'>('all');

  useEffect(() => {
    if (!open || !rep) return;
    setLoading(true); setItems([]); setQuery(''); setFilter('all');
    api.repAssignments(rep.rep_id, startISO, endISO)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, rep, startISO, endISO]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'skipped') list = list.filter((i) => i.was_skipped);
    else if (filter === 'failed') list = list.filter((i) => i.ghl_sync_status === 'failed');
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((i) =>
        i.contact_name?.toLowerCase().includes(q) ||
        i.contact_email?.toLowerCase().includes(q) ||
        i.contact_phone?.toLowerCase().includes(q) ||
        i.ghl_contact_id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, query, filter]);

  if (!open || !rep) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-ink-200 flex flex-col animate-in slide-in-from-right">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={rep.name} src={rep.avatar_url} size="md" />
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-ink-500">Leads de</div>
              <div className="text-base font-semibold text-ink-900 truncate">{rep.name}</div>
              <div className="text-[11px] text-ink-500">
                {total} no período · mostrando {filtered.length}
                {total > items.length && <span className="ml-1 text-amber-600">(cap 500)</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Filters */}
        <div className="border-b border-ink-200 px-5 py-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Buscar por nome, email, telefone..." className="pl-9 h-8 text-xs" />
          </div>
          <div className="flex gap-1 rounded-md bg-ink-100 p-0.5">
            {(['all', 'skipped', 'failed'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                      className={cn(
                        'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                        filter === f ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900',
                      )}>
                {f === 'all' ? 'Todos' : f === 'skipped' ? 'Pulados' : 'Falhas'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-500">Nenhum lead encontrado.</div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="divide-y divide-ink-100">
              {filtered.map((it) => (
                <div key={it.id} className="px-5 py-3 hover:bg-ink-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900 truncate">{it.contact_name ?? '—'}</span>
                        {it.was_skipped && <Badge tone="warn"><SkipForward className="h-3 w-3" /> pulado</Badge>}
                        {it.ghl_sync_status === 'synced' && <Badge tone="success"><CheckCircle2 className="h-3 w-3" /></Badge>}
                        {it.ghl_sync_status === 'failed' && <Badge tone="danger" title={it.ghl_sync_error ?? undefined}><XCircle className="h-3 w-3" /></Badge>}
                        {it.ghl_sync_status === 'pending' && <Badge tone="neutral"><Clock className="h-3 w-3" /></Badge>}
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {it.contact_email ?? it.contact_phone ?? it.ghl_contact_id}
                      </div>
                      {it.contact_tags && it.contact_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.contact_tags.slice(0, 4).map((t) => (
                            <span key={t} className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">{t}</span>
                          ))}
                          {it.contact_tags.length > 4 && (
                            <span className="text-[10px] text-ink-400">+{it.contact_tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-ink-600" title={new Date(it.created_at).toLocaleString('pt-BR')}>
                        {formatAdaptive(it.created_at)}
                      </div>
                      <div className="text-[10px] text-ink-400">{formatRelative(it.created_at)}</div>
                      <a
                        href={`https://app.gohighlevel.com/v2/location/contacts/detail/${it.ghl_contact_id}`}
                        target="_top"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-600 hover:underline"
                      >
                        Abrir no GHL <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
