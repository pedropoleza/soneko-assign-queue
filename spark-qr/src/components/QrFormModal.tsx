import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { api, ApiError } from '@/api';
import { publicUrl } from '@/config';
import { downloadPng, downloadSvg, qrPngDataUrl } from '@/lib/qr';
import type { QrCode, SlugCheck } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: QrCode | null;
};

const SLUG_REASON: Record<string, string> = {
  invalid_format: 'Use 2-50 caracteres: letras minúsculas, números e hífens.',
  reserved: 'Esse slug é reservado pelo sistema.',
  taken: 'Esse slug já está em uso.',
};

function slugify(v: string): string {
  return v.toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 50);
}

export function QrFormModal({ open, onClose, onSaved, editing }: Props) {
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Reset when (re)opened.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setTargetUrl(editing?.target_url ?? '');
    setSlugTouched(false);
    setCheck(null);
  }, [open, editing]);

  // Live slug availability (debounced).
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    if (isEdit && slug === editing?.slug) { setCheck({ slug, available: true, reason: null }); return; }
    if (!slug) { setCheck(null); return; }
    setChecking(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await api.checkSlug(slug, editing?.id ?? null);
        setCheck(r);
      } catch { setCheck(null); }
      finally { setChecking(false); }
    }, 350);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [slug, open, isEdit, editing]);

  // Live QR preview of the public URL.
  const liveUrl = useMemo(() => (slug ? publicUrl(slug) : ''), [slug]);
  useEffect(() => {
    let alive = true;
    if (!liveUrl) { setPreview(null); return; }
    qrPngDataUrl(liveUrl, 320).then((d) => { if (alive) setPreview(d); }).catch(() => {});
    return () => { alive = false; };
  }, [liveUrl]);

  const slugOk = check?.available === true;
  const canSave =
    !!targetUrl.trim() && /^https?:\/\//i.test(targetUrl.trim()) && slugOk && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && editing) {
        await api.update(editing.id, {
          name: name.trim(),
          slug,
          target_url: targetUrl.trim(),
        });
        toast.success('QR atualizado.');
      } else {
        await api.create({ name: name.trim(), slug, target_url: targetUrl.trim() });
        toast.success('QR criado.');
      }
      onSaved();
      onClose();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'erro';
      toast.error(`Não foi possível salvar (${code}).`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar QR' : 'Novo QR'}
      subtitle={isEdit ? 'Trocar o destino mantém o mesmo QR — não precisa reimprimir.' : 'Slug curto + destino. O QR aponta pro slug; o destino é editável depois.'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Salvar' : 'Criar QR'}
          </button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <label className="label">Nome (interno)</label>
            <input className="input" value={name} placeholder="Ex: Cartaz vitrine loja 1"
              onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">Slug</label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-ink-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
              <span className="flex items-center bg-ink-50 px-2.5 text-xs text-ink-400 border-r border-ink-200">/</span>
              <input
                className="w-full px-3 py-2 text-sm outline-none placeholder:text-ink-400"
                value={slug}
                placeholder="minha-promo"
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              />
              <span className="flex items-center pr-2.5">
                {checking ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                  : check == null ? null
                  : slugOk ? <Check className="h-4 w-4 text-emerald-600" />
                  : <X className="h-4 w-4 text-rose-500" />}
              </span>
            </div>
            {slugTouched && check && !slugOk && check.reason && (
              <p className="mt-1 text-xs text-rose-600">{SLUG_REASON[check.reason] ?? 'Slug inválido.'}</p>
            )}
            {slugOk && slug && (
              <p className="mt-1 truncate text-xs text-ink-400">{publicUrl(slug)}</p>
            )}
          </div>

          <div>
            <label className="label">URL de destino</label>
            <input className="input" value={targetUrl} placeholder="https://..."
              onChange={(e) => setTargetUrl(e.target.value)} />
            {targetUrl && !/^https?:\/\//i.test(targetUrl.trim()) && (
              <p className="mt-1 text-xs text-rose-600">Comece com http:// ou https://</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:w-52">
          <div className="grid h-44 w-44 place-items-center rounded-lg border border-ink-200 bg-white p-2">
            {preview ? <img src={preview} alt="QR preview" className="h-full w-full object-contain" />
              : <span className="text-xs text-ink-400">prévia do QR</span>}
          </div>
          <div className="flex w-full gap-2">
            <button className="btn-outline flex-1" disabled={!slugOk || !slug}
              onClick={() => downloadPng(publicUrl(slug), slug)}>
              <Download className="h-3.5 w-3.5" /> PNG
            </button>
            <button className="btn-outline flex-1" disabled={!slugOk || !slug}
              onClick={() => downloadSvg(publicUrl(slug), slug)}>
              <Download className="h-3.5 w-3.5" /> SVG
            </button>
          </div>
          <p className="text-center text-[11px] leading-tight text-ink-400">
            O QR codifica o slug. Editar o destino depois não muda a imagem.
          </p>
        </div>
      </div>
    </Modal>
  );
}
