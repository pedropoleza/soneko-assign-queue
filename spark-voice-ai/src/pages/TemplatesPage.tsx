import { useRef, useState } from 'react';
import { Plus, Trash2, Eye, FileText, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { notifyError, toast } from '@/lib/toast';
import { Button, Field, Input, Textarea, Select, Badge, EmptyState } from '@/components/ui/primitives';
import { ALLOWED_VARIABLES, mapGhlFields } from '@/types';
import type { AudioTemplate, Snippet } from '@/types';

const EVENT_TYPES = ['new_lead', 'birthday', 'reminder', 'appointment', 'follow_up', 'custom'];
const emptyForm = { name: '', event_type: 'new_lead', language: 'pt-BR', tone: '', template_text: '' };

export function TemplatesPage() {
  const { data: templates, loading, reload } = useAsync<AudioTemplate[]>(() => api.listTemplates(), []);
  // snippets do GHL — tolerante a endpoint ainda não implementado no backend
  const { data: snippets } = useAsync<Snippet[]>(() => api.listSnippets().catch(() => [] as Snippet[]), []);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const token = `{{${v}}}`;
    const el = textRef.current;
    if (!el) return setForm((f) => ({ ...f, template_text: f.template_text + token }));
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setForm((f) => ({ ...f, template_text: f.template_text.slice(0, start) + token + f.template_text.slice(end) }));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  function useSnippet(s: Snippet) {
    setForm((f) => ({ ...f, name: s.name, template_text: mapGhlFields(s.body) }));
    requestAnimationFrame(() => textRef.current?.focus());
    toast.success('Snippet carregado no editor (merge fields convertidos).');
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

  function doPreview() {
    const rendered = form.template_text
      .replace(/\{\{\s*(first_name|full_name|user_name)\s*\}\}/g, 'Ana')
      .replace(/\{\{\s*business_name\s*\}\}/g, 'Clínica Sol')
      .replace(/\{\{\s*[a-z_]+\s*\}\}/g, '…');
    setPreview(rendered);
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
    <div>
      <p className="lead">Mensagens dinâmicas</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            <Field label="Mensagem" hint="Variáveis fora da allow-list são rejeitadas.">
              <Textarea ref={textRef} required value={form.template_text} onChange={(e) => setForm({ ...form, template_text: e.target.value })} placeholder="Oi {{first_name}}, aqui é da {{business_name}}…" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVar(v)} className="pill">{`{{${v}}}`}</button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="glass" size="sm" onClick={doPreview}><Eye size={14} /> Preview</Button>
              <Button type="submit" size="sm" disabled={saving}><Plus size={14} /> {saving ? 'Salvando…' : 'Criar template'}</Button>
            </div>
            {preview != null && (
              <div className="rounded-xl border border-ink-200 bg-ink-50 p-3.5">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Texto final</div>
                <div className="text-sm text-ink-800">{preview || <span className="text-ink-400">—</span>}</div>
              </div>
            )}
          </div>
        </form>

        {/* Snippets + Templates */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Snippets da location</span>
              <span className="flex items-center gap-2">
                <button className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:text-brand-700" title="Sincronizar da SparkLeads"><RefreshCw size={14} /></button>
                <Badge tone="brand">SparkLeads</Badge>
              </span>
            </div>
            {snippets && snippets.length ? (
              <div className="max-h-[300px] overflow-auto">
                {snippets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5 last:border-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900">{s.name}</div>
                      <div className="truncate text-[13px] text-ink-500">{s.body}</div>
                    </div>
                    <Button variant="glass" size="sm" className="shrink-0" onClick={() => useSnippet(s)}>Usar</Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum snippet sincronizado" hint="Os snippets da location aparecem aqui quando a sincronização com a SparkLeads estiver ativa." />
            )}
            <div className="border-t border-ink-100 px-5 py-3 text-xs text-ink-400">
              Os merge fields da SparkLeads (<code>{'{{contact.first_name}}'}</code>…) são convertidos para a allow-list do Spark ao usar.
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Seus templates</span>{templates && <Badge tone="ink">{templates.length}</Badge>}</div>
            <div>
              {loading ? (
                <div className="p-5"><div className="h-16 animate-pulse rounded-xl bg-ink-100" /></div>
              ) : templates?.length ? (
                templates.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 border-b border-ink-100 p-4 last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-ink-400" />
                        <span className="font-semibold text-ink-900">{t.name}</span>
                        <Badge tone={t.active ? 'green' : 'ink'}>{t.active ? 'ativo' : 'inativo'}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                        <Badge tone="brand">{t.event_type}</Badge><span>{t.language}</span>{t.tone && <span>· {t.tone}</span>}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{t.template_text}</p>
                    </div>
                    <Button variant="danger" size="sm" className="shrink-0" onClick={() => remove(t.id)}><Trash2 size={14} /></Button>
                  </div>
                ))
              ) : (
                <EmptyState title="Nenhum template" hint="Crie o primeiro template ao lado." />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
