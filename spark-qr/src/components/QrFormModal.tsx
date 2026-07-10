import { useEffect, useMemo, useState } from 'react';
import { Download, Link2, Loader2, MessageCircle, Link as LinkIcon, Tag } from 'lucide-react';
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

type DestType = 'url' | 'whatsapp';

// Short, clean, collision-safe code (e.g. "k3p9zq"). The user never sees or
// manages a slug — the system mints the short link for them.
function genSlug(len = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const isWaUrl = (u: string) => /(?:^|\/\/)(?:wa\.me|api\.whatsapp\.com|whatsapp\.com)/i.test(u);

function buildWaUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '';
  const base = `https://wa.me/${digits}`;
  const msg = message.trim();
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}

export function QrFormModal({ open, onClose, onSaved, editing }: Props) {
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [destType, setDestType] = useState<DestType>('url');
  const [targetUrl, setTargetUrl] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [origin, setOrigin] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Reset on open. In edit mode, detect whether the stored target is a WhatsApp
  // link and pre-fill the builder; otherwise it's a plain URL.
  useEffect(() => {
    if (!open) return;
    const t = editing?.target_url ?? '';
    setName(editing?.name ?? '');
    setOrigin(editing?.origin ?? '');
    setSlug(editing?.slug ?? genSlug());
    if (t && isWaUrl(t)) {
      setDestType('whatsapp');
      try {
        const u = new URL(t);
        const fromPath = u.pathname.replace(/\D/g, '');
        const fromQuery = (u.searchParams.get('phone') ?? '').replace(/\D/g, '');
        setWaPhone(fromPath || fromQuery);
        setWaMessage(u.searchParams.get('text') ?? '');
      } catch { /* ignore */ }
      setTargetUrl('');
    } else {
      setDestType('url');
      setTargetUrl(t);
      setWaPhone('');
      setWaMessage('');
    }
  }, [open, editing]);

  const effectiveTarget = destType === 'whatsapp' ? buildWaUrl(waPhone, waMessage) : targetUrl.trim();

  const liveUrl = useMemo(() => (slug ? publicUrl(slug) : ''), [slug]);
  const prettyUrl = liveUrl.replace(/^https?:\/\//, '');

  // Live QR preview (encodes the short link, not the destination — so the QR
  // never changes when the destination or origin is edited later).
  useEffect(() => {
    let alive = true;
    if (!liveUrl) { setPreview(null); return; }
    qrPngDataUrl(liveUrl, 512).then((d) => { if (alive) setPreview(d); }).catch(() => {});
    return () => { alive = false; };
  }, [liveUrl]);

  const urlOk = /^https?:\/\//i.test(effectiveTarget);
  const canSave = urlOk && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const originClean = origin.trim();
      if (isEdit && editing) {
        await api.update(editing.id, { name: name.trim(), target_url: effectiveTarget, origin: originClean });
        toast.success('QR atualizado.');
      } else {
        let attempt = slug;
        for (let i = 0; i < 2; i++) {
          try {
            await api.create({ name: name.trim(), slug: attempt, target_url: effectiveTarget, origin: originClean });
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
        : 'Dê um nome e escolha o destino. O link curto é gerado automaticamente.'}
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

          {/* Destination type */}
          <div>
            <label className="label">Destino</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDestType('url')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  destType === 'url' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'}`}>
                <LinkIcon className="h-4 w-4" /> Link (URL)
              </button>
              <button type="button" onClick={() => setDestType('whatsapp')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  destType === 'whatsapp' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'}`}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
            </div>
          </div>

          {destType === 'url' ? (
            <div>
              <label className="label">URL de destino</label>
              <input className="input" value={targetUrl} placeholder="https://..."
                onChange={(e) => setTargetUrl(e.target.value)} />
              {targetUrl && !urlOk && (
                <p className="mt-1.5 text-sm text-rose-600">Comece com http:// ou https://</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Número do WhatsApp</label>
                <input className="input" value={waPhone} inputMode="tel"
                  placeholder="+1 508 589 9433" onChange={(e) => setWaPhone(e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">Com código do país (ex: +1). Só números são usados.</p>
              </div>
              <div>
                <label className="label">Mensagem inicial (opcional)</label>
                <textarea className="input min-h-[72px] resize-y" value={waMessage}
                  placeholder="Olá! Vim pelo QR e gostaria de mais informações."
                  onChange={(e) => setWaMessage(e.target.value)} />
              </div>
              {effectiveTarget && (
                <p className="truncate rounded-lg bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700">
                  {effectiveTarget.replace(/^https?:\/\//, '')}
                </p>
              )}
            </div>
          )}

          {/* Origin tag */}
          <div>
            <label className="label flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Origem (opcional)</label>
            <input className="input" value={origin} placeholder="Ex: padaria-centro, feira-sabado"
              onChange={(e) => setOrigin(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">
              Diferencia QRs que apontam pro mesmo destino. Vai embutido no link final
              ({destType === 'whatsapp' ? 'na mensagem' : '?source='}) e cada QR mantém métricas próprias.
            </p>
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
