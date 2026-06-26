import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open, onClose, title, subtitle, children, footer, wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div
        className={`card my-4 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-in fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost -mr-1.5 h-8 w-8 px-0" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
