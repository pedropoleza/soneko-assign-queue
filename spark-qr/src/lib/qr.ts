import QRCode from 'qrcode';

const OPTS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
  color: { dark: '#0F172A', light: '#FFFFFF' },
};

export async function qrPngDataUrl(text: string, width = 320): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTS, width });
}

// Synchronous QR matrix — used to render the thumbnail as an inline SVG with no
// async/canvas step (avoids effect-timing races during list re-renders).
export function qrSvgPath(text: string): { size: number; d: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size: number = qr.modules.size;
  const data = qr.modules.data;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}

export async function qrSvgString(text: string): Promise<string> {
  return QRCode.toString(text, { ...OPTS, type: 'svg', width: 320 });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadPng(text: string, slug: string) {
  const url = await QRCode.toDataURL(text, { ...OPTS, width: 1024 });
  triggerDownload(url, `qr-${slug}.png`);
}

export async function downloadSvg(text: string, slug: string) {
  const svg = await qrSvgString(text);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `qr-${slug}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
