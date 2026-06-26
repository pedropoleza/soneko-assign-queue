import { useMemo } from 'react';
import { qrSvgPath } from '@/lib/qr';

// Renders the QR fully synchronously as an inline SVG — no async data-URL/canvas
// step, so it can't race with list re-renders (which left thumbnails blank).
export function QrThumb({ url, size = 96, className = '' }: { url: string; size?: number; className?: string }) {
  const { size: n, d } = useMemo(() => qrSvgPath(url), [url]);
  const m = 2; // quiet zone in modules
  const vb = n + m * 2;

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`${-m} ${-m} ${vb} ${vb}`} width="100%" height="100%" shapeRendering="crispEdges">
        <path d={d} fill="#0F172A" />
      </svg>
    </div>
  );
}
