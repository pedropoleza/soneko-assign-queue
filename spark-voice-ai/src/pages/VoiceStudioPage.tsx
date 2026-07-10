import { useState } from 'react';
import { Mic, Trash2, ShieldCheck, Upload, Check, Sparkles, BadgeCheck, CalendarClock, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { notifyError, toast } from '@/lib/toast';
import { Button, Field, Input, Select, Badge, EmptyState } from '@/components/ui/primitives';
import { WaveformPlayer } from '@/components/WaveformPlayer';
import { ConfigureSendModal } from '@/components/ConfigureSendModal';
import { formatDateTime } from '@/lib/utils';
import type { AppState, AudioGeneration, AudioSend, AudioTemplate, Voice } from '@/types';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const SEND_BADGE: Record<AudioSend['status'], { tone: 'brand' | 'amber' | 'green' | 'ink' | 'red'; label: string }> = {
  scheduled: { tone: 'brand', label: 'agendado' },
  missing_dob: { tone: 'amber', label: 'sem Date of Birth' },
  sent: { tone: 'green', label: 'enviado' },
  cancelled: { tone: 'ink', label: 'cancelado' },
  failed: { tone: 'red', label: 'falhou' },
};

const LANGUAGES = [
  ['pt-BR', 'Português (BR)'],
  ['en-US', 'English (US)'],
  ['es-ES', 'Español'],
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const GEN_STEPS = [
  'Validando template…',
  'Substituindo variáveis…',
  'Sintetizando voz (ElevenLabs)…',
  'Salvando no storage…',
];

export function VoiceStudioPage({ state }: { state: AppState }) {
  const { data: voices, loading, reload } = useAsync<Voice[]>(() => api.listVoices(), []);
  const { data: templates } = useAsync<AudioTemplate[]>(() => api.listTemplates(), []);
  const activeVoice = voices?.find((v) => v.status === 'active') ?? state.active_voice ?? null;

  // cadastro de voz
  const [form, setForm] = useState({
    voice_name: '',
    language: 'pt-BR',
    voice_owner_name: state.account.owner_name ?? state.account.company_name,
  });
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  // geração TTS
  const [templateId, setTemplateId] = useState('');
  const [sampleName, setSampleName] = useState('Ana');
  const [genState, setGenState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [genStep, setGenStep] = useState(0);
  const [result, setResult] = useState<AudioGeneration | null>(null);

  // envios agendados
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const { data: sends, reload: reloadSends } = useAsync<AudioSend[]>(() => api.listSends().catch(() => [] as AudioSend[]), []);
  const selectedTemplate = templates?.find((t) => t.id === templateId) ?? null;

  async function cancelSend(id: string) {
    try {
      await api.cancelSend(id);
      toast.success('Envio cancelado.');
      reloadSends();
    } catch (err) {
      notifyError(err);
    }
  }

  async function createVoice(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error('Selecione um sample de áudio.');
    if (!consent) return toast.error('É obrigatório aceitar o consentimento.');
    setSaving(true);
    try {
      const sample_base64 = await fileToBase64(file);
      await api.createVoice({ ...form, sample_base64, consent_accepted: true });
      toast.success('Voz clonada e ativada.');
      setFile(null);
      setConsent(false);
      setForm((f) => ({ ...f, voice_name: '' }));
      reload();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeVoice(id: string) {
    try {
      await api.deleteVoice(id);
      toast.success('Voz excluída.');
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  async function generate() {
    if (!templateId) return;
    setGenState('running');
    setGenStep(0);
    setResult(null);
    const ticker = setInterval(() => setGenStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 650);
    try {
      const gen = await api.testAudio({ template_id: templateId, sample_name: sampleName });
      setResult(gen);
      setGenState('done');
    } catch (err) {
      notifyError(err);
      setGenState('error');
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="lead">Voz clonada · consentimento</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Voz ativa */}
          <div className="lg:col-span-2">
            <div className="card h-full">
              <div className="card-header">
                <span className="card-title">Voz ativa</span>
                {activeVoice && (
                  <Badge tone="green">
                    <span className="statusdot" /> on air
                  </Badge>
                )}
              </div>
              <div className="p-5">
                {loading && !activeVoice ? (
                  <div className="h-24 animate-pulse rounded-xl bg-ink-100" />
                ) : activeVoice ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                        <Mic size={20} />
                      </span>
                      <div>
                        <div className="text-[15px] font-bold text-ink-900">{activeVoice.voice_name}</div>
                        <div className="text-xs text-ink-500">{activeVoice.language} · {activeVoice.provider}</div>
                      </div>
                    </div>
                    <WaveformPlayer />
                    <dl className="space-y-1.5 text-[13px] text-ink-500">
                      <div className="flex justify-between"><dt>Titular</dt><dd className="text-ink-700">{activeVoice.voice_owner_name}</dd></div>
                      <div className="flex justify-between">
                        <dt>Consentimento</dt>
                        <dd className="text-green-600">✓ {formatDateTime(activeVoice.consent_accepted_at)}</dd>
                      </div>
                    </dl>
                    <Button variant="danger" size="sm" onClick={() => removeVoice(activeVoice.id)}>
                      <Trash2 size={14} /> Excluir voz
                    </Button>
                  </div>
                ) : (
                  <EmptyState title="Nenhuma voz ativa" hint="Cadastre uma voz para habilitar a geração." />
                )}
              </div>
            </div>
          </div>

          {/* Cadastrar nova voz */}
          <div className="lg:col-span-3">
            <form onSubmit={createVoice} className="card">
              <div className="card-header"><span className="card-title">Cadastrar nova voz</span></div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nome da voz">
                    <Input required value={form.voice_name} onChange={(e) => setForm({ ...form, voice_name: e.target.value })} placeholder="Dra. Marina — acolhedora" />
                  </Field>
                  <Field label="Idioma">
                    <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                      {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Titular da voz" hint="Detectado da sua conta SparkLeads — é você, logado, quem autoriza o uso desta voz.">
                  <div className="relative">
                    <Input value={form.voice_owner_name} onChange={(e) => setForm({ ...form, voice_owner_name: e.target.value })} className="pr-24" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Badge tone="brand"><BadgeCheck size={12} /> sua conta</Badge>
                    </span>
                  </div>
                </Field>
                <Field label="Sample de áudio" hint="MP3/WAV com fala clara do titular (Instant Voice Clone).">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3.5 py-3 text-sm text-ink-500 hover:border-brand-400">
                    <Upload size={16} />
                    {file ? file.name : 'Arraste um MP3/WAV ou clique para enviar…'}
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                </Field>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <label className="flex items-start gap-2.5 text-[13px] text-amber-900">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-brand-600" />
                    <span className="flex items-start gap-1.5">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-600" />
                      Declaro que possuo autorização do titular para clonar e usar esta voz, e assumo responsabilidade conforme a política de conteúdo.
                    </span>
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    <Check size={15} /> {saving ? 'Clonando…' : 'Clonar e ativar'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Gerar áudio (TTS) */}
      <div>
        <p className="lead">Gerar áudio · Text-to-Speech</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card h-fit">
            <div className="card-header"><span className="card-title">Gerar áudio</span></div>
            <div className="space-y-4 p-5">
              <Field label="Template">
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">{templates ? 'Selecione um template' : 'Carregando…'}</option>
                  {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.event_type}</option>)}
                </Select>
              </Field>
              <Field label="Nome fictício" hint="Substitui {{first_name}}/{{full_name}} no preview.">
                <Input value={sampleName} onChange={(e) => setSampleName(e.target.value)} />
              </Field>
              <div className="flex justify-end">
                <Button onClick={generate} disabled={!templateId || genState === 'running'}>
                  <Sparkles size={15} /> {genState === 'running' ? 'Gerando…' : 'Gerar áudio'}
                </Button>
              </div>
            </div>
          </div>

          <div className="card h-fit">
            <div className="card-header">
              <span className="card-title">Resultado</span>
              <Badge tone={genState === 'done' ? 'green' : genState === 'running' ? 'amber' : genState === 'error' ? 'red' : 'brand'}>
                {genState === 'done' ? 'completed' : genState === 'running' ? 'gerando…' : genState === 'error' ? 'erro' : 'pronto'}
              </Badge>
            </div>
            <div className="p-5">
              {genState === 'running' ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-7 text-center">
                  <div className="flex h-14 items-end gap-1">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-[5px] rounded bg-gradient-to-b from-brand-500 to-brand-700"
                        style={{ height: '20%', animation: `genv .9s ease-in-out ${i * 0.09}s infinite` }}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-ink-700">{GEN_STEPS[genStep]}</div>
                </div>
              ) : genState === 'done' && result ? (
                <div className="rise space-y-4">
                  <div className="rounded-xl border border-ink-200 bg-ink-50 p-3.5">
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Texto final</div>
                    <div className="text-sm leading-relaxed text-ink-900">{result.final_text}</div>
                  </div>
                  {result.audio_url ? (
                    <WaveformPlayer src={result.audio_url} duration="0:06" />
                  ) : (
                    <div className="text-sm text-red-600">Falha: {result.error_message ?? 'erro'}</div>
                  )}
                  <div className="flex items-center justify-between text-xs text-ink-400">
                    <span>{result.characters_used} caracteres</span>
                    {result.charged != null && (
                      <span>debitado ${result.charged} · saldo ${result.balance}</span>
                    )}
                  </div>
                  {result.audio_url && selectedTemplate && (
                    <div className="flex justify-end border-t border-ink-100 pt-4">
                      <Button variant="glass" onClick={() => setSendModalOpen(true)}>
                        <CalendarClock size={15} /> Configurar envio deste áudio
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-7 text-center">
                  <div className="flex h-14 items-end gap-1">
                    {[30, 60, 40, 80, 35, 65, 45].map((h, i) => (
                      <span key={i} className="w-[5px] rounded bg-gradient-to-b from-brand-500 to-brand-700" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="text-sm text-ink-500">Selecione um template e clique em Gerar</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Envios agendados */}
      <div>
        <p className="lead">Envios agendados</p>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Agendamentos</span>
            {sends && <Badge tone="ink">{sends.filter((s) => s.status === 'scheduled' || s.status === 'missing_dob').length} ativos</Badge>}
          </div>
          {sends?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-[10.5px] uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-2.5 font-semibold">Contato</th>
                    <th className="px-4 py-2.5 font-semibold">Evento</th>
                    <th className="px-4 py-2.5 font-semibold">Data de envio</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sends.map((s) => (
                    <tr key={s.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                      <td className="px-4 py-2.5 font-semibold text-ink-900">{s.contact_name ?? s.contact_id}</td>
                      <td className="px-4 py-2.5 text-ink-500">{s.event_type ?? '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-700">{fmtDate(s.send_date)}</td>
                      <td className="px-4 py-2.5"><Badge tone={SEND_BADGE[s.status].tone}>{SEND_BADGE[s.status].label}</Badge></td>
                      <td className="px-4 py-2.5 text-right">
                        {(s.status === 'scheduled' || s.status === 'missing_dob') && (
                          <button onClick={() => cancelSend(s.id)} className="text-ink-400 transition hover:text-red-600" title="Cancelar envio">
                            <XCircle size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum envio agendado" hint="Gere um áudio e clique em Configurar envio para agendar pelo aniversário do contato." />
          )}
        </div>
      </div>

      {selectedTemplate && (
        <ConfigureSendModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
          template={selectedTemplate}
          defaultQuery={sampleName}
          onCreated={reloadSends}
        />
      )}
    </div>
  );
}
