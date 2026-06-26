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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div
        className={`card my-4 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} animate-in fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink-100 px-8 py-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
            {subtitle && <p className="mt-1.5 text-base text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost -mr-2 h-12 w-12 px-0" aria-label="Fechar">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="px-8 py-6">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-8 py-5">{footer}</div>}
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
