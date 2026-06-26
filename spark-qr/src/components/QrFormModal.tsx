import { useEffect, useMemo, useState } from 'react';
import { Download, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { api, ApiError } from '@/api';
import { publicUrl } from '@/config';
import { downloadPng, downloadSvg, qrPngDataUrl } from '@/lib/qr';
import type { QrCode } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: QrCode | null;
};

// Short, clean, collision-safe code (e.g. "k3p9zq"). The user never sees or
// manages a slug — the system mints the short link for them.
function genSlug(len = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function QrFormModal({ open, onClose, onSaved, editing }: Props) {
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Reset on open: in create mode mint a fresh short code so the preview is live.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setTargetUrl(editing?.target_url ?? '');
    setSlug(editing?.slug ?? genSlug());
  }, [open, editing]);

  const liveUrl = useMemo(() => (slug ? publicUrl(slug) : ''), [slug]);
  const prettyUrl = liveUrl.replace(/^https?:\/\//, '');

  // Live QR preview.
  useEffect(() => {
    let alive = true;
    if (!liveUrl) { setPreview(null); return; }
    qrPngDataUrl(liveUrl, 512).then((d) => { if (alive) setPreview(d); }).catch(() => {});
    return () => { alive = false; };
  }, [liveUrl]);

  const urlOk = /^https?:\/\//i.test(targetUrl.trim());
  const canSave = urlOk && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && editing) {
        await api.update(editing.id, { name: name.trim(), target_url: targetUrl.trim() });
        toast.success('QR atualizado.');
      } else {
        // Retry once with a fresh code on the (astronomically rare) collision.
        let attempt = slug;
        for (let i = 0; i < 2; i++) {
          try {
            await api.create({ name: name.trim(), slug: attempt, target_url: targetUrl.trim() });
            break;
          } catch (e) {
            if (e instanceof ApiError && e.code === 'slug_taken' && i === 0) { attempt = genSlug(); continue; }
            throw e;
          }
        }
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
      subtitle={isEdit
        ? 'Trocar o destino mantém o mesmo QR — não precisa reimprimir.'
        : 'Dê um nome e cole o destino. O link curto é gerado automaticamente.'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={!canSave}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isEdit ? 'Salvar' : 'Criar QR'}
          </button>
        </>
      }
    >
      <div className="grid gap-7 sm:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} placeholder="Ex: Cartaz vitrine loja 1"
              autoFocus onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">URL de destino</label>
            <input className="input" value={targetUrl} placeholder="https://..."
              onChange={(e) => setTargetUrl(e.target.value)} />
            {targetUrl && !urlOk && (
              <p className="mt-1.5 text-sm text-rose-600">Comece com http:// ou https://</p>
            )}
          </div>

          <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Link2 className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="truncate font-mono text-ink-700">{prettyUrl}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              Link curto do QR. {isEdit ? 'Fixo — o destino acima é o que muda.' : 'Gerado para você.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:w-60">
          <div className="grid h-56 w-56 place-items-center rounded-2xl border border-ink-200 bg-white p-3">
            {preview ? <img src={preview} alt="QR preview" className="h-full w-full object-contain" />
              : <span className="text-sm text-ink-400">prévia do QR</span>}
          </div>
          <div className="flex w-full gap-2">
            <button className="btn-outline flex-1 px-3 text-sm" onClick={() => downloadPng(liveUrl, slug)}>
              <Download className="h-4 w-4" /> PNG
            </button>
            <button className="btn-outline flex-1 px-3 text-sm" onClick={() => downloadSvg(liveUrl, slug)}>
              <Download className="h-4 w-4" /> SVG
            </button>
          </div>
          <p className="text-center text-xs leading-snug text-ink-400">
            Editar o destino depois não muda esta imagem.
          </p>
        </div>
      </div>
    </Modal>
  );
}
