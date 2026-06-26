import { useEffect, useState } from 'react';
import { QrCode as QrIcon } from 'lucide-react';
import { qrPngDataUrl } from '@/lib/qr';

export function QrThumb({ url, size = 96, className = '' }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // No abort guard on purpose: in some mount/re-render sequences the cleanup
    // fired before the (fast) data-URL promise resolved, dropping the result and
    // leaving the thumbnail blank. React 18 safely ignores setState after unmount.
    qrPngDataUrl(url, size * 2).then(setSrc).catch(() => {});
  }, [url, size]);

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-200 bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      {src
        ? <img src={src} alt="QR code" className="h-full w-full object-contain p-1.5" />
        : <QrIcon className="h-6 w-6 text-ink-300" />}
    </div>
  );
}
