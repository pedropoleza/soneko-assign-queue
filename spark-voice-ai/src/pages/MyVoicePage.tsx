import { useState } from 'react';
import { Mic, Trash2, ShieldCheck, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { notifyError, toast } from '@/lib/toast';
import { Button, Field, Input, Select, Badge, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';
import type { Voice } from '@/types';

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

export function MyVoicePage() {
  const { data: voices, loading, reload } = useAsync<Voice[]>(() => api.listVoices(), []);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ voice_name: '', language: 'pt-BR', voice_owner_name: '' });
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  const activeVoice = voices?.find((v) => v.status === 'active') ?? null;

  async function createVoice(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error('Selecione um sample de áudio.');
    if (!consent) return toast.error('É obrigatório aceitar o consentimento.');
    setSaving(true);
    try {
      const sample_base64 = await fileToBase64(file);
      await api.createVoice({ ...form, sample_base64, consent_accepted: true });
      toast.success('Voz cadastrada e ativada.');
      setForm({ voice_name: '', language: 'pt-BR', voice_owner_name: '' });
      setFile(null);
      setConsent(false);
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

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      {/* Voz ativa */}
      <div className="lg:col-span-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Voz ativa</span>
            {activeVoice && <Badge tone="green">ativa</Badge>}
          </div>
          <div className="p-5">
            {loading ? (
              <div className="h-20 animate-pulse rounded-lg bg-ink-100" />
            ) : activeVoice ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Mic size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">{activeVoice.voice_name}</div>
                    <div className="text-xs text-ink-500">{activeVoice.language} · {activeVoice.provider}</div>
                  </div>
                </div>
                <dl className="space-y-1 text-xs text-ink-500">
                  <div className="flex justify-between"><dt>Titular da voz</dt><dd className="text-ink-700">{activeVoice.voice_owner_name}</dd></div>
                  <div className="flex justify-between">
                    <dt>Consentimento</dt>
                    <dd className="text-green-700">{formatDateTime(activeVoice.consent_accepted_at)}</dd>
                  </div>
                </dl>
                <Button variant="danger" onClick={() => removeVoice(activeVoice.id)}>
                  <Trash2 size={14} /> Excluir voz
                </Button>
              </div>
            ) : (
              <EmptyState title="Nenhuma voz ativa" hint="Cadastre uma voz para habilitar a geração de áudio." />
            )}
          </div>
        </div>
      </div>

      {/* Cadastro */}
      <div className="lg:col-span-3">
        <form onSubmit={createVoice} className="card">
          <div className="card-header"><span className="card-title">Cadastrar / substituir voz</span></div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome da voz">
                <Input required value={form.voice_name} onChange={(e) => setForm({ ...form, voice_name: e.target.value })} placeholder="Ex: Dra. Marina — acolhedora" />
              </Field>
              <Field label="Idioma">
                <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Titular da voz (quem autoriza o uso)">
              <Input required value={form.voice_owner_name} onChange={(e) => setForm({ ...form, voice_owner_name: e.target.value })} placeholder="Nome completo do titular" />
            </Field>
            <Field label="Sample de áudio" hint="MP3/WAV com fala clara do titular. Usado para clonagem (Instant Voice Clone).">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-600 hover:border-brand-400">
                <Upload size={15} />
                {file ? file.name : 'Escolher arquivo de áudio…'}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>

            {/* Consentimento obrigatório (seção 2.3) */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-start gap-2 text-xs text-amber-900">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span className="flex items-start gap-1.5">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  Declaro que possuo autorização do titular para clonar e utilizar esta voz na geração de áudios, e assumo responsabilidade pelo uso conforme a política de conteúdo.
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Cadastrando…' : 'Cadastrar voz'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
