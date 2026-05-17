import { CheckCircle2, Clock, ExternalLink, SkipForward, XCircle } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { formatRelative } from '@/lib/utils';
import type { Assignment } from '@/types';

export function AssignmentsTable({
  assignments,
  onSkip,
}: {
  assignments: Assignment[];
  onSkip: (a: Assignment) => void;
}) {
  if (assignments.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-500">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ink-100">
          <Clock className="h-6 w-6 text-ink-400" />
        </div>
        <div className="mt-3 text-sm font-medium text-ink-700">Nenhuma atribuição ainda</div>
        <div className="text-xs">Quando um contato for criado no GHL, ele aparece aqui.</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title">Atribuições recentes</div>
          <div className="text-xs text-ink-500">Últimos {assignments.length} leads recebidos do GHL</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-5 py-2.5 font-medium">Contato</th>
              <th className="px-3 py-2.5 font-medium">Vendedor</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Sync</th>
              <th className="px-3 py-2.5 font-medium">Recebido</th>
              <th className="px-5 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="table-row">
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-ink-900 truncate max-w-[260px]">
                      {a.contact_name ?? '—'}
                    </span>
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
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {a.was_skipped ? (
                    <Badge tone="warn"><SkipForward className="h-3 w-3" /> Pulado</Badge>
                  ) : (
                    <Badge tone="brand">Round-robin</Badge>
                  )}
                </td>
                <td className="px-3 py-3">
                  {a.ghl_sync_status === 'synced' ? (
                    <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Sincronizado</Badge>
                  ) : a.ghl_sync_status === 'pending' ? (
                    <Badge tone="neutral"><Clock className="h-3 w-3" /> Pendente</Badge>
                  ) : (
                    <Badge tone="danger" title={a.ghl_sync_error ?? undefined}>
                      <XCircle className="h-3 w-3" /> Falhou
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-600 text-xs">{formatRelative(a.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <a
                      href={`https://app.gohighlevel.com/v2/location/${a.ghl_contact_id}`}
                      target="_top"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                      onClick={(e) => e.stopPropagation()}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
