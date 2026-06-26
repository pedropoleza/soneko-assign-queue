import { BarChart3, Copy, Download, ExternalLink, Pencil, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { QrThumb } from './QrThumb';
import { publicUrl } from '@/config';
import { downloadPng } from '@/lib/qr';
import type { QrCode } from '@/types';

function relTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function QrCard({
  qr, onAnalytics, onEdit, onToggle, onDelete,
}: {
  qr: QrCode;
  onAnalytics: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const link = publicUrl(qr.slug);
  const pretty = link.replace(/^https?:\/\//, '');

  function copy() {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar.'),
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex gap-4">
        <QrThumb url={link} size={104} className={qr.is_active ? '' : 'opacity-50 grayscale'} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-base font-semibold text-ink-900">{qr.name || 'Sem nome'}</span>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${qr.is_active ? 'bg-emerald-500' : 'bg-ink-300'}`}
              title={qr.is_active ? 'Ativo' : 'Inativo'} />
          </div>

          <button onClick={copy} title="Copiar link"
            className="mt-1 flex items-center gap-1.5 text-left text-sm text-brand-600 hover:text-brand-700">
            <span className="truncate font-mono">{pretty}</span>
            <Copy className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>

          <div className="mt-1 truncate text-sm text-ink-500" title={qr.target_url}>
            → {qr.target_url}
          </div>

          <div className="mt-auto pt-2">
            <span className="text-2xl font-bold tabular-nums text-ink-900">{qr.scans ?? 0}</span>
            <span className="ml-1.5 text-xs text-ink-400">
              scans · {qr.scans_7d ? `+${qr.scans_7d} 7d · ` : ''}{relTime(qr.last_scan_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 border-t border-ink-100 pt-3">
        <a className="btn-ghost h-9 w-9 px-0" title="Abrir link" href={link} target="_blank" rel="noreferrer">
          <ExternalLink className="h-[18px] w-[18px]" />
        </a>
        <button className="btn-ghost h-9 w-9 px-0" title="Baixar PNG" onClick={() => downloadPng(link, qr.slug)}>
          <Download className="h-[18px] w-[18px]" />
        </button>
        <button className="btn-ghost h-9 w-9 px-0" title="Analytics" onClick={onAnalytics}>
          <BarChart3 className="h-[18px] w-[18px]" />
        </button>
        <button className="btn-ghost h-9 w-9 px-0" title="Editar" onClick={onEdit}>
          <Pencil className="h-[18px] w-[18px]" />
        </button>
        <div className="flex-1" />
        <button
          className={`btn-ghost h-9 w-9 px-0 ${qr.is_active ? 'text-emerald-600' : 'text-ink-400'}`}
          title={qr.is_active ? 'Desativar' : 'Ativar'}
          onClick={onToggle}
        >
          <Power className="h-[18px] w-[18px]" />
        </button>
        <button className="btn-ghost h-9 w-9 px-0 text-rose-500 hover:bg-rose-50" title="Excluir" onClick={onDelete}>
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
