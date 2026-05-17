import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Mail, MapPin, Phone, Tag, User2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { Assignment, SalesRep } from '@/types';

export function ContactDrawer({
  open,
  onClose,
  assignment,
  rep,
}: {
  open: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  rep: SalesRep | null;
}) {
  const [contact, setContact] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !assignment) return;
    setLoading(true); setError(null); setContact(null);
    api.contact(assignment.ghl_contact_id)
      .then((d) => setContact(d.contact ?? d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, assignment]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-l border-ink-200 flex flex-col animate-in slide-in-from-right">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-500">Lead</div>
            <div className="text-base font-semibold text-ink-900 truncate max-w-[300px]">
              {assignment?.contact_name ?? '—'}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Assignment summary */}
          <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 mb-2">Atribuído a</div>
            {rep ? (
              <div className="flex items-center gap-3">
                <Avatar name={rep.name} src={rep.avatar_url} size="md" />
                <div>
                  <div className="font-semibold text-ink-900">{rep.name}</div>
                  <div className="text-xs text-ink-500">{rep.email ?? '—'}</div>
                </div>
              </div>
            ) : (<div className="text-sm text-ink-400">Sem vendedor</div>)}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Stat label="Recebido" value={formatDateTime(assignment?.created_at)} />
              <Stat label="Sync" value={assignment?.ghl_sync_status ?? '—'} />
              {assignment?.was_skipped && <Stat label="Pulado" value="sim" />}
              {assignment?.sync_attempts && assignment.sync_attempts > 1 ? (
                <Stat label="Tentativas" value={String(assignment.sync_attempts)} />
              ) : null}
            </div>
          </div>

          {/* Contact details from GHL */}
          {loading && (
            <div className="flex items-center justify-center py-8 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Erro ao buscar contato no GHL: {error}
            </div>
          )}
          {contact && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 mb-2">Dados do contato</div>
                <div className="space-y-2 text-sm">
                  <Field icon={<User2 className="h-3.5 w-3.5" />} label="Nome" value={contact.contactName ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()} />
                  <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact.email} />
                  <Field icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={contact.phone} />
                  <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Origem" value={contact.source} />
                  <Field icon={<MapPin className="h-3.5 w-3.5" />} label="País" value={contact.country} />
                </div>
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((t: string) => (
                      <Badge key={t} tone="neutral">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {contact.customFields && contact.customFields.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 mb-2">Custom fields</div>
                  <div className="space-y-1 text-xs">
                    {contact.customFields.slice(0, 10).map((cf: any) => (
                      <div key={cf.id} className="flex justify-between gap-2">
                        <span className="text-ink-500 truncate">{cf.id}</span>
                        <span className="text-ink-800 truncate">{String(cf.value ?? '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="border-t border-ink-200 px-5 py-3">
          <a
            href={`https://app.gohighlevel.com/v2/location/contacts/detail/${assignment?.ghl_contact_id}`}
            target="_top"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir no GHL
          </a>
        </footer>
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-ink-900">{value ?? '—'}</div>
    </div>
  );
}
function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
        <div className="text-ink-900 truncate">{value}</div>
      </div>
    </div>
  );
}
