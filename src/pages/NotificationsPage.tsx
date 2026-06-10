import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Bell, Clock, FileText, Loader2, MessageSquare, Phone, Plus, Send, Trash2, Users, X } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
];

const NO_DATA_CHANNEL_OPTIONS = [
  { value: '__all__', label: 'Todos os canais' },
];

function useChannels() {
  const [opts, setOpts] = useState(NO_DATA_CHANNEL_OPTIONS);
  useEffect(() => {
    api.listChannels()
      .then((chs) => {
        const list = chs
          .filter((c) => c.source && c.source !== '— sem origem —')
          .map((c) => ({
            value: c.source,
            label: c.source === 'WhatsApp'
              ? `WhatsApp (inclui SMS) · ${c.count}`
              : `${c.source} · ${c.count}`,
          }));
        setOpts([{ value: '__all__', label: 'Todos os canais' }, ...list]);
      })
      .catch(() => {});
  }, []);
  return opts;
}

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
];

const SCHEDULE_OPTIONS = [
  { id: 'manual', label: 'Manual' },
  { id: 'daily', label: 'Diário' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
] as const;

function scheduleLabel(r: { schedule_type: string; schedule_day_of_week: number | null; schedule_day_of_month: number | null; schedule_time: string }) {
  const time = r.schedule_time?.slice(0, 5) ?? '09:00';
  if (r.schedule_type === 'manual') return 'Manual';
  if (r.schedule_type === 'daily') return `Todo dia às ${time}`;
  if (r.schedule_type === 'weekly') {
    const dow = WEEKDAY_OPTIONS.find((d) => d.value === String(r.schedule_day_of_week))?.label ?? '?';
    return `Toda ${dow.toLowerCase()} às ${time}`;
  }
  if (r.schedule_type === 'monthly') return `Dia ${r.schedule_day_of_month ?? '?'} de cada mês às ${time}`;
  return r.schedule_type;
}

type Recipient = Awaited<ReturnType<typeof api.listRecipients>>[number];

export function NotificationsPage() {
  const [list, setList] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Partial<Recipient> | null>(null);
  const [sender, setSender] = useState<Recipient | null>(null);

  async function reload() {
    setLoading(true);
    try { setList(await api.listRecipients()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: string) {
    try { await api.deleteRecipient(id); toast.success('Destinatário removido'); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand-600" /> Notificações internas via GHL
          </div>
          <div className="text-xs text-ink-500 mt-1">
            Configure quem recebe o resumo de leads por SMS/WhatsApp interno. Envio manual sob demanda.
          </div>
        </div>
        <Button onClick={() => setEditor({})}>
          <Plus className="h-3.5 w-3.5" /> Adicionar destinatário
        </Button>
      </div>

      {loading && (
        <div className="card p-12 grid place-items-center text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="card p-12 text-center text-sm text-ink-500">
          Nenhum destinatário ainda. Clique em <strong className="text-ink-700">Adicionar destinatário</strong> para começar.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar name={r.name} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">{r.name}</div>
                    <div className="text-xs text-ink-500 flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="brand">
                        {PERIOD_OPTIONS.find((p) => p.value === r.default_period)?.label ?? r.default_period}
                      </Badge>
                      <Badge tone="neutral">
                        {r.default_source ?? 'Todos os canais'}
                      </Badge>
                      <Badge tone={r.enabled && r.schedule_type !== 'manual' ? 'success' : 'neutral'}>
                        <Clock className="h-3 w-3" /> {scheduleLabel(r)}
                      </Badge>
                    </div>
                    <div className="mt-1.5 text-[11px] text-ink-500 space-y-0.5">
                      {r.last_sent_at && (
                        <div>Último envio: {formatRelative(r.last_sent_at)}</div>
                      )}
                      {r.enabled && r.schedule_type !== 'manual' && r.next_run_at && (
                        <div>Próximo envio: {new Date(r.next_run_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      )}
                      {!r.enabled && r.schedule_type !== 'manual' && (
                        <div className="text-amber-600">Agendamento desativado</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditor(r)} title="Editar">
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)} title="Remover">
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              </div>
              <Button className="mt-3 w-full" onClick={() => setSender(r)}>
                <Send className="h-3.5 w-3.5" /> Enviar agora
              </Button>
            </div>
          ))}
        </div>
      )}

      {editor !== null && (
        <RecipientEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); reload(); }}
        />
      )}

      {sender !== null && (
        <SendDialog
          recipient={sender}
          onClose={() => setSender(null)}
        />
      )}
    </div>
  );
}

function RecipientEditor({
  initial, onClose, onSaved,
}: {
  initial: Partial<Recipient>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const channelOptions = useChannels();
  const [name, setName] = useState(initial.name ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [ghlUserId, setGhlUserId] = useState(initial.ghl_user_id ?? '');
  const [defaultPeriod, setDefaultPeriod] = useState(initial.default_period ?? 'yesterday');
  const [defaultSource, setDefaultSource] = useState<string | undefined>(initial.default_source ?? '__all__');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [scheduleType, setScheduleType] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>(
    (initial.schedule_type as any) ?? 'manual');
  const [scheduleTime, setScheduleTime] = useState(initial.schedule_time?.slice(0, 5) ?? '09:00');
  const [scheduleDow, setScheduleDow] = useState<string | undefined>(
    initial.schedule_day_of_week ? String(initial.schedule_day_of_week) : '1');
  const [scheduleDom, setScheduleDom] = useState<number>(initial.schedule_day_of_month ?? 1);
  const [enabled, setEnabled] = useState<boolean>(initial.enabled ?? false);
  const [format, setFormat] = useState<'text' | 'pdf'>((initial.default_format as any) ?? 'text');
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone?: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = !initial.id;

  async function loadUsers() {
    if (users.length > 0) return;
    setUsersLoading(true);
    try {
      const r = await api.ghlUsers();
      setUsers(r.users ?? []);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUsersLoading(false); }
  }
  useEffect(() => { loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function pickUser(uid: string) {
    setGhlUserId(uid);
    const u = users.find((x) => x.id === uid);
    if (u) {
      if (!name) setName(u.name);
      if (u.phone) setPhone(u.phone);
      else toast.warning('Esse usuário não tem telefone no GHL — informe manualmente.');
    }
  }

  async function save() {
    if (!name.trim() || !phone.trim()) { toast.error('Nome e telefone são obrigatórios'); return; }
    setSaving(true);
    try {
      await api.saveRecipient({
        id: initial.id ?? null,
        name: name.trim(), phone: phone.trim(),
        ghl_user_id: ghlUserId || null,
        ghl_contact_id: initial.ghl_contact_id ?? null,
        default_period: defaultPeriod,
        default_source: defaultSource === '__all__' ? null : defaultSource,
        default_format: format,
        notes: notes || null,
        schedule_type: scheduleType,
        schedule_day_of_week: scheduleType === 'weekly' ? Number(scheduleDow) : null,
        schedule_day_of_month: scheduleType === 'monthly' ? scheduleDom : null,
        schedule_time: scheduleTime,
        schedule_timezone: 'America/Sao_Paulo',
        enabled: scheduleType === 'manual' ? false : enabled,
      });
      toast.success(isNew ? 'Destinatário criado' : 'Destinatário atualizado');
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? 'Novo destinatário' : `Editar ${initial.name}`}
      description="Configure quem recebe o resumo de leads via SMS/WhatsApp interno do GHL."
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Puxar de usuário GHL</label>
          {usersLoading ? (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando usuários…
            </div>
          ) : (
            <Select
              value={ghlUserId || undefined}
              onChange={pickUser}
              placeholder="Escolher usuário GHL (auto-preenche nome e telefone)..."
              options={users.map((u) => ({
                value: u.id,
                label: `${u.name}${u.phone ? ` · ${u.phone}` : ' · sem telefone'}`,
              }))}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do destinatário" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Telefone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511…" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Período padrão</label>
            <Select value={defaultPeriod} onChange={setDefaultPeriod}
                    options={PERIOD_OPTIONS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Canal padrão</label>
            <Select value={defaultSource} onChange={setDefaultSource}
                    options={channelOptions} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Formato da mensagem</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('text')}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                format === 'text' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <MessageSquare className="h-4 w-4 text-brand-600" /> Texto (SMS)
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Resumo formatado direto no chat</div>
            </button>
            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                format === 'pdf' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <FileText className="h-4 w-4 text-rose-600" /> PDF (WhatsApp)
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Relatório com gráficos anexado</div>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Notas (opcional)</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: gerente comercial" />
        </div>

        <div className="rounded-lg border border-ink-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-ink-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-600" /> Agendamento
              </div>
              <div className="text-[11px] text-ink-500">Envio automático sob recorrência</div>
            </div>
            {scheduleType !== 'manual' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-600">{enabled ? 'Ativo' : 'Pausado'}</span>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {SCHEDULE_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScheduleType(s.id)}
                className={`rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  scheduleType === s.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {scheduleType !== 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              {scheduleType === 'weekly' && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-600">Dia da semana</label>
                  <Select value={scheduleDow} onChange={setScheduleDow} options={WEEKDAY_OPTIONS} />
                </div>
              )}
              {scheduleType === 'monthly' && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-600">Dia do mês</label>
                  <Input type="number" min={1} max={31} value={scheduleDom}
                         onChange={(e) => setScheduleDom(Math.max(1, Math.min(31, +e.target.value || 1)))} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-600">Horário</label>
                <Input type="time" value={scheduleTime}
                       onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
          Ao enviar, o app procura um contato no GHL com esse telefone; se não houver, cria um com a tag
          <code className="mx-1 text-ink-700">soneko-internal-notification</code> e dispara a mensagem
          via Conversations API.
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>
            <Plus className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SendDialog({ recipient, onClose }: { recipient: Recipient; onClose: () => void }) {
  const channelOptions = useChannels();
  const [period, setPeriod] = useState(recipient.default_period);
  const [source, setSource] = useState<string | undefined>(recipient.default_source ?? '__all__');
  const [format, setFormat] = useState<'text' | 'pdf'>((recipient.default_format as any) ?? 'text');
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  async function doPreview() {
    setPreviewing(true); setPdfUrl(null);
    try {
      const r = await api.notificationPreview({
        period,
        source: source === '__all__' ? null : source,
        format,
        recipient_id: recipient.id,
      });
      setPreview(r.message);
      if (r.pdf_url) setPdfUrl(r.pdf_url);
      if (r.pdf_error) toast.warning(`PDF: ${r.pdf_error}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setPreviewing(false); }
  }

  useEffect(() => { doPreview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, source, format]);

  async function send() {
    setSending(true);
    try {
      await api.notificationSend({
        recipient_id: recipient.id, period,
        source: source === '__all__' ? null : source,
        format,
      });
      toast.success(`Mensagem enviada para ${recipient.name}`);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(v) => !v && onClose()}
      title={`Enviar para ${recipient.name}`}
      description={`SMS interno via GHL para ${recipient.phone}`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Período</label>
            <Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Canal</label>
            <Select value={source} onChange={setSource} options={channelOptions} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Formato</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFormat('text')}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      format === 'text' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                    }`}>
              <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <MessageSquare className="h-4 w-4 text-brand-600" /> Texto
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">SMS direto no chat</div>
            </button>
            <button type="button" onClick={() => setFormat('pdf')}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      format === 'pdf' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                    }`}>
              <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <FileText className="h-4 w-4 text-rose-600" /> PDF
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Anexado via WhatsApp</div>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600 flex items-center gap-2">
            Prévia do conteúdo
            {previewing && <Loader2 className="h-3 w-3 animate-spin text-ink-400" />}
          </label>
          <pre className={cn(
            'rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[12px] whitespace-pre-wrap',
            'max-h-72 overflow-y-auto font-mono text-ink-800',
          )}>
            {preview ?? 'Carregando prévia…'}
          </pre>
          {format === 'pdf' && pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
               className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
              <FileText className="h-3 w-3" /> Abrir prévia do PDF
            </a>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button onClick={send} loading={sending}>
            <Send className="h-3.5 w-3.5" /> Enviar agora
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
