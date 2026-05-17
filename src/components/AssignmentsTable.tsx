import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, RotateCw, SkipForward, XCircle } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { cn, formatRelative } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Assignment } from '@/types';

export function AssignmentsTable({
  assignments,
  onSkip,
  onOpenContact,
  selectable = false,
  selected,
  onSelectChange,
  onRetry,
}: {
  assignments: Assignment[];
  onSkip: (a: Assignment) => void;
  onOpenContact: (a: Assignment) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectChange?: (s: Set<string>) => void;
  onRetry?: () => void;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retry(a: Assignment) {
    setRetrying(a.id);
    try {
      const res = await api.retry(a.id);
      if (res.sync === 'synced') toast.success(`Sincronizado com ${res.rep?.name ?? '?'}`);
      else toast.error(`Ainda falhando: ${res.error}`);
      onRetry?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(null);
    }
  }

  function toggleSelect(id: string) {
    if (!selected || !onSelectChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectChange(next);
  }
  function toggleAll() {
    if (!selected || !onSelectChange) return;
    if (selected.size === assignments.length) onSelectChange(new Set());
    else onSelectChange(new Set(assignments.map((a) => a.id)));
  }

  if (assignments.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-500">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ink-100">
          <Clock className="h-6 w-6 text-ink-400" />
        </div>
        <div className="mt-3 text-sm font-medium text-ink-700">Nenhuma atribuição</div>
        <div className="text-xs">Quando um contato for criado no GHL, ele aparece aqui.</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              {selectable && (
                <th className="pl-5 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    className="rounded border-ink-300"
                    checked={!!selected && selected.size === assignments.length && assignments.length > 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th className="px-5 py-2.5 font-medium">Contato</th>
              <th className="px-3 py-2.5 font-medium">Vendedor</th>
              <th className="px-3 py-2.5 font-medium">Tags</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Sync</th>
              <th className="px-3 py-2.5 font-medium">Recebido</th>
              <th className="px-5 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const isSelected = !!selected?.has(a.id);
              return (
              <tr
                key={a.id}
                className={cn(
                  'border-b border-ink-100 last:border-0 transition-colors cursor-pointer',
                  isSelected ? 'bg-brand-50/50' : 'hover:bg-ink-50/60',
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).closest('button, a')) return;
                  onOpenContact(a);
                }}
              >
                {selectable && (
                  <td className="pl-5 pr-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-ink-300" checked={isSelected} onChange={() => toggleSelect(a.id)} />
                  </td>
                )}
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-ink-900 truncate max-w-[260px]">{a.contact_name ?? '—'}</span>
                    <span className="text-[11px] text-ink-500 truncate max-w-[260px]">
                      {a.contact_email ?? a.contact_phone ?? a.ghl_contact_id}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {a.rep_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={a.rep_name} src={a.rep_avatar} size="xs" />
                      <span className="text-ink-800">{a.rep_name}</span>
                    </div>
                  ) : (<span className="text-ink-400">—</span>)}
                </td>
                <td className="px-3 py-3">
                  {a.contact_tags && a.contact_tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {a.contact_tags.slice(0, 2).map((t) => (
                        <Badge key={t} tone="neutral" className="text-[10px]">{t}</Badge>
                      ))}
                      {a.contact_tags.length > 2 && (
                        <span className="text-[10px] text-ink-500">+{a.contact_tags.length - 2}</span>
                      )}
                    </div>
                  ) : (<span className="text-ink-300">—</span>)}
                </td>
                <td className="px-3 py-3">
                  {a.was_skipped ? (
                    <Badge tone="warn"><SkipForward className="h-3 w-3" /> Pulado</Badge>
                  ) : (<Badge tone="brand">Round-robin</Badge>)}
                </td>
                <td className="px-3 py-3">
                  {a.ghl_sync_status === 'synced' ? (
                    <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Ok</Badge>
                  ) : a.ghl_sync_status === 'pending' ? (
                    <Badge tone="neutral"><Clock className="h-3 w-3" /> Pendente</Badge>
                  ) : (
                    <Badge tone="danger" title={a.ghl_sync_error ?? undefined}>
                      <XCircle className="h-3 w-3" /> Falhou{a.sync_attempts > 1 ? ` (${a.sync_attempts}x)` : ''}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-600 text-xs">{formatRelative(a.created_at)}</td>
                <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {a.ghl_sync_status === 'failed' && (
                      <Button size="sm" variant="ghost" onClick={() => retry(a)} loading={retrying === a.id} title="Tentar sincronizar de novo">
                        <RotateCw className="h-3 w-3" />
                      </Button>
                    )}
                    <a
                      href={`https://app.gohighlevel.com/v2/location/contacts/detail/${a.ghl_contact_id}`}
                      target="_top"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                      title="Abrir contato no GHL"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button size="sm" variant="outline" onClick={() => onSkip(a)}>
                      <SkipForward className="h-3 w-3" />
                      Pular
                    </Button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
      {assignments.some((a) => a.ghl_sync_status === 'failed') && (
        <div className="border-t border-ink-100 bg-amber-50/40 px-5 py-2 flex items-center gap-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          Atribuições com falha são reprocessadas automaticamente a cada 2min (até 5 tentativas).
        </div>
      )}
    </div>
  );
}
