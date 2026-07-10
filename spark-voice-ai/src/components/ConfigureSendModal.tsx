import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, CalendarDays, Send, Check, Loader2, AlertTriangle, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { notifyError, toast } from '@/lib/toast';
import { Badge, Button, Input } from '@/components/ui/primitives';
import type { AudioTemplate, GhlContact } from '@/types';

// Modal "Configurar envio": mapeia contatos da location pelo nome usado no
// áudio (ex.: Gabriel), valida o campo Date of Birth — denunciando quando
// vazio, com correção inline gravada de volta na location — e agenda o envio
// do áudio para a data do aniversário de cada contato selecionado.

function fmtDob(dob: string | null): string {
  if (!dob) return '—';
  const [y, m, d] = dob.split('-');
  return `${d}/${m}/${y}`;
}

function nextBirthdayLabel(dob: string): string {
  const [, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let year = now.getFullYear();
  const today = new Date(year, now.getMonth(), now.getDate()).getTime();
  if (new Date(year, m - 1, d).getTime() < today) year++;
  return new Date(year, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ConfigureSendModal({
  open,
  onOpenChange,
  template,
  defaultQuery,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: AudioTemplate;
  defaultQuery: string;
  onCreated?: () => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [contacts, setContacts] = useState<GhlContact[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dobDrafts, setDobDrafts] = useState<Record<string, string>>({});
  const [savingDob, setSavingDob] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      setContacts(null);
      setSelected({});
      setDobDrafts({});
    }
  }, [open, defaultQuery]);

  async function search() {
    setSearching(true);
    try {
      const found = await api.searchContacts(query.trim());
      setContacts(found);
      // pré-seleciona quem já tem Date of Birth
      const pre: Record<string, boolean> = {};
      found.forEach((c) => {
        if (c.dob) pre[c.id] = true;
      });
      setSelected(pre);
    } catch (err) {
      notifyError(err);
      setContacts([]);
    } finally {
      setSearching(false);
    }
  }

  async function saveDob(c: GhlContact) {
    const dob = dobDrafts[c.id];
    if (!dob) return toast.error('Informe a data de nascimento.');
    setSavingDob(c.id);
    try {
      await api.updateContactDob(c.id, dob);
      setContacts((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, dob } : x)));
      setSelected((s) => ({ ...s, [c.id]: true }));
      toast.success(`Date of Birth salvo para ${c.name}.`);
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingDob(null);
    }
  }

  const ready = useMemo(() => (contacts ?? []).filter((c) => c.dob && selected[c.id]), [contacts, selected]);
  const missing = useMemo(() => (contacts ?? []).filter((c) => !c.dob), [contacts]);

  async function schedule() {
    if (!ready.length) return;
    setCreating(true);
    try {
      const res = await api.createSends({
        template_id: template.id,
        event_type: template.event_type,
        contacts: ready.map((c) => ({
          contact_id: c.id,
          contact_name: c.name,
          contact_phone: c.phone,
          dob: c.dob,
        })),
      });
      toast.success(`${res.scheduled} envio(s) agendado(s) no aniversário.`);
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm fade-in animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,960px)] -translate-x-1/2 -translate-y-1/2 rise focus:outline-none">
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="card-header bg-white">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <Dialog.Title className="text-[16px] font-bold tracking-tight text-ink-900">
                    Configurar envio do áudio
                  </Dialog.Title>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">{template.name}</span>
                    <Badge tone="brand">{template.event_type}</Badge>
                  </div>
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:text-ink-800" aria-label="Fechar">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            {/* Explicação + busca */}
            <div className="border-b border-ink-100 bg-ink-50/60 px-5 py-4">
              <p className="mb-3 text-[13px] text-ink-500">
                O áudio menciona um nome — busque os contatos correspondentes na location. O envio é agendado
                pela data do campo <b className="text-ink-700">Date of Birth</b> de cada contato; quando o campo
                estiver vazio, ele é sinalizado abaixo para você definir antes de agendar.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                    className="pl-10"
                    placeholder="Nome mencionado no áudio (ex.: Gabriel)"
                  />
                </div>
                <Button onClick={search} disabled={searching || !query.trim()}>
                  {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar contatos
                </Button>
              </div>
            </div>

            {/* Resultados */}
            <div className="max-h-[46vh] overflow-auto">
              {searching ? (
                <div className="p-6">
                  <div className="h-16 animate-pulse rounded-xl bg-ink-100" />
                </div>
              ) : contacts === null ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-ink-400">
                  <Search size={22} className="text-ink-300" />
                  Busque pelo nome usado no áudio para mapear os contatos.
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-ink-400">
                  Nenhum contato encontrado para “{query}”.
                </div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3.5 last:border-0 hover:bg-ink-50/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600 disabled:opacity-40"
                      checked={!!selected[c.id] && !!c.dob}
                      disabled={!c.dob}
                      onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))}
                    />
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                      {(c.first_name ?? c.name).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink-900">{c.name}</div>
                      <div className="truncate text-xs text-ink-500">{[c.phone, c.email].filter(Boolean).join(' · ') || 'sem contato'}</div>
                    </div>
                    {c.dob ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="green"><CalendarDays size={12} /> {fmtDob(c.dob)}</Badge>
                        <span className="text-xs tabular-nums text-ink-400">envia {nextBirthdayLabel(c.dob)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                        <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">sem Date of Birth</span>
                        <input
                          type="date"
                          value={dobDrafts[c.id] ?? ''}
                          onChange={(e) => setDobDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                          className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-ink-700 focus:border-brand-400 focus:outline-none"
                        />
                        <Button variant="glass" size="sm" onClick={() => saveDob(c)} disabled={savingDob === c.id || !dobDrafts[c.id]}>
                          {savingDob === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Definir
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-white px-5 py-4">
              <div className="text-sm text-ink-500">
                {contacts?.length ? (
                  <>
                    <b className="text-ink-800">{ready.length}</b> pronto(s) para agendar
                    {missing.length > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle size={13} /> {missing.length} sem Date of Birth
                      </span>
                    )}
                  </>
                ) : (
                  'Selecione os contatos que receberão o áudio no aniversário.'
                )}
              </div>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button variant="glass">Cancelar</Button>
                </Dialog.Close>
                <Button onClick={schedule} disabled={!ready.length || creating}>
                  {creating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Agendar envio ({ready.length})
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
