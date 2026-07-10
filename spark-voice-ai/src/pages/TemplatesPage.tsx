import { useRef, useState } from 'react';
import { Plus, Trash2, Eye, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { notifyError, toast } from '@/lib/toast';
import { Button, Field, Input, Textarea, Select, Badge, EmptyState } from '@/components/ui/primitives';
import { ALLOWED_VARIABLES } from '@/types';
import type { AudioTemplate } from '@/types';

const EVENT_TYPES = ['new_lead', 'birthday', 'reminder', 'appointment', 'follow_up', 'custom'];

const emptyForm = { name: '', event_type: 'new_lead', language: 'pt-BR', tone: '', template_text: '' };

export function TemplatesPage() {
  const { data: templates, loading, reload } = useAsync<AudioTemplate[]>(() => api.listTemplates(), []);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ final_text: string; characters: number } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const token = `{{${v}}}`;
    const el = textRef.current;
    if (!el) return setForm((f) => ({ ...f, template_text: f.template_text + token }));
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = form.template_text.slice(0, start) + token + form.template_text.slice(end);
    setForm((f) => ({ ...f, template_text: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createTemplate({
        name: form.name,
        event_type: form.event_type,
        language: form.language,
        tone: form.tone || null,
        template_text: form.template_text,
      });
      toast.success('Template criado.');
      setForm(emptyForm);
      setPreview(null);
      reload();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  async function doPreview() {
    try {
      // cria um preview local via endpoint precisa de template salvo; aqui usamos
      // um preview otimista pelo texto atual chamando /audio/preview após salvar.
      // Para o editor, mostramos o texto substituindo por um nome de exemplo.
      const sample = 'Ana';
      const rendered = form.template_text.replace(/\{\{\s*(first_name|full_name|user_name)\s*\}\}/g, sample);
      setPreview({ final_text: rendered.replace(/\{\{\s*[a-z_]+\s*\}\}/g, '…'), characters: rendered.length });
    } catch (err) {
      notifyError(err);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteTemplate(id);
      toast.success('Template removido.');
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Editor */}
      <form onSubmit={save} className="card h-fit">
        <div className="card-header"><span className="card-title">Novo template</span></div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Boas-vindas novo lead" /></Field>
            <Field label="Evento">
              <Select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Idioma"><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></Field>
            <Field label="Tom (opcional)"><Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="acolhedor, direto…" /></Field>
          </div>

          <Field label="Mensagem" hint="Use as variáveis abaixo. Variáveis fora da lista são rejeitadas.">
            <Textarea ref={textRef} required value={form.template_text} onChange={(e) => setForm({ ...form, template_text: e.target.value })} placeholder="Oi {{first_name}}, aqui é da {{business_name}}…" />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {ALLOWED_VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insertVar(v)} className="pill hover:border-brand-300 hover:text-brand-700">
                {`{{${v}}}`}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={doPreview}><Eye size={14} /> Preview</Button>
            <Button type="submit" disabled={saving}><Plus size={14} /> {saving ? 'Salvando…' : 'Criar template'}</Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Texto final (exemplo)</div>
              <div className="text-sm text-ink-800">{preview.final_text || <span className="text-ink-400">—</span>}</div>
            </div>
          )}
        </div>
      </form>

      {/* Lista */}
      <div className="card h-fit">
        <div className="card-header"><span className="card-title">Templates</span></div>
        <div className="divide-y divide-ink-100">
          {loading ? (
            <div className="p-5"><div className="h-16 animate-pulse rounded-lg bg-ink-100" /></div>
          ) : templates?.length ? (
            templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-ink-400" />
                    <span className="font-medium text-ink-900">{t.name}</span>
                    <Badge tone={t.active ? 'green' : 'ink'}>{t.active ? 'ativo' : 'inativo'}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    <Badge tone="brand">{t.event_type}</Badge>
                    <span>{t.language}</span>{t.tone && <span>· {t.tone}</span>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{t.template_text}</p>
                </div>
                <Button variant="danger" onClick={() => remove(t.id)} className="shrink-0"><Trash2 size={14} /></Button>
              </div>
            ))
          ) : (
            <EmptyState title="Nenhum template" hint="Crie o primeiro template ao lado." />
          )}
        </div>
      </div>
    </div>
  );
}
