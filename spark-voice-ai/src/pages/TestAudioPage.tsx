import { useState } from 'react';
import { Play, Sparkles, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { notifyError } from '@/lib/toast';
import { Button, Field, Input, Select, EmptyState } from '@/components/ui/primitives';
import type { AudioGeneration, AudioTemplate } from '@/types';

export function TestAudioPage() {
  const { data: templates, loading } = useAsync<AudioTemplate[]>(() => api.listTemplates(), []);
  const [templateId, setTemplateId] = useState('');
  const [sampleName, setSampleName] = useState('Ana');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AudioGeneration | null>(null);

  async function generate() {
    if (!templateId) return;
    setGenerating(true);
    setResult(null);
    try {
      const gen = await api.testAudio({ template_id: templateId, sample_name: sampleName });
      setResult(gen);
    } catch (err) {
      notifyError(err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5">
      <div className="card">
        <div className="card-header"><span className="card-title">Gerar áudio de teste</span></div>
        <div className="space-y-4 p-5">
          <Field label="Template">
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={loading}>
              <option value="">{loading ? 'Carregando…' : 'Selecione um template'}</option>
              {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.event_type}</option>)}
            </Select>
          </Field>
          <Field label="Nome fictício" hint="Substitui {{first_name}}/{{full_name}} no preview.">
            <Input value={sampleName} onChange={(e) => setSampleName(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={!templateId || generating}>
              <Sparkles size={14} /> {generating ? 'Gerando…' : 'Gerar áudio'}
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Resultado</span></div>
        <div className="p-5">
          {generating ? (
            <div className="h-16 animate-pulse rounded-lg bg-ink-100" />
          ) : result ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Texto final</div>
                <div className="text-sm text-ink-800">{result.final_text}</div>
              </div>
              {result.audio_url ? (
                <div className="space-y-2">
                  <audio controls src={result.audio_url} className="w-full">
                    <track kind="captions" />
                  </audio>
                  <a href={result.audio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                    <ExternalLink size={12} /> Abrir link do áudio
                  </a>
                </div>
              ) : (
                <div className="text-sm text-red-600">Falha na geração: {result.error_message ?? 'erro'}</div>
              )}
              <div className="text-xs text-ink-400">{result.characters_used} caracteres · custo estimado US$ {result.estimated_cost ?? 0}</div>
            </div>
          ) : (
            <EmptyState title="Nenhuma geração ainda" hint={<span className="inline-flex items-center gap-1"><Play size={12} /> Selecione um template e gere um teste.</span>} />
          )}
        </div>
      </div>
    </div>
  );
}
