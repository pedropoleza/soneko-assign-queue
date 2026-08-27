// ---------------------------------------------------------------------------
// O rastreio vive na própria URL — não existe página intermediária.
//
//   https://talk.sparkleads.com/maria-silva/black-friday?s=story&m=instagram&ct=a
//                              └── quem ──┘└─ campanha ─┘  └──── onde/como ────┘
//
// `s`, `m`, `c` e `ct` são o nosso equivalente ao utm_source/medium/campaign/
// content. O redirecionador também aceita os `utm_*` completos, para quem já
// tem o hábito.
// ---------------------------------------------------------------------------

export type TrackParams = {
  src?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

/** Onde o link costuma ser colado. Vira `?s=` com um clique. */
export const PLACEMENTS = [
  { value: 'bio', label: 'Bio', medium: 'instagram' },
  { value: 'story', label: 'Story', medium: 'instagram' },
  { value: 'post', label: 'Post', medium: 'instagram' },
  { value: 'reels', label: 'Reels', medium: 'instagram' },
  { value: 'tiktok', label: 'TikTok', medium: 'tiktok' },
  { value: 'youtube', label: 'YouTube', medium: 'youtube' },
  { value: 'grupo', label: 'Grupo', medium: 'whatsapp' },
  { value: 'status', label: 'Status', medium: 'whatsapp' },
  { value: 'email', label: 'E-mail', medium: 'email' },
  { value: 'anuncio', label: 'Anúncio', medium: 'ads' },
] as const;

const KEYS: Array<[keyof TrackParams, string]> = [
  ['src', 's'],
  ['medium', 'm'],
  ['campaign', 'c'],
  ['content', 'ct'],
];

export function buildTrackedUrl(shortUrl: string, params: TrackParams): string {
  const clean = (shortUrl ?? '').replace(/\?.*$/, '');
  const qs = new URLSearchParams();
  for (const [field, key] of KEYS) {
    const value = (params[field] ?? '').trim().toLowerCase();
    if (value) qs.set(key, value);
  }
  const q = qs.toString();
  return q ? `${clean}?${q}` : clean;
}

/** Rótulo legível de uma origem para a UI. */
export function placementLabel(src: string | null | undefined): string {
  if (!src || src === 'direto') return 'Direto';
  return PLACEMENTS.find((p) => p.value === src)?.label ?? src;
}

// O app de onde a pessoa saiu, detectado pelo navegador embutido. Diferente da
// origem declarada no link: esta a gente observa, não depende de marcação.
const APP_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  messenger: 'Messenger',
  twitter: 'X/Twitter',
  linkedin: 'LinkedIn',
  snapchat: 'Snapchat',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
};

/** Rótulo legível do app de origem detectado no clique. */
export function appLabel(app: string | null | undefined): string | null {
  if (!app) return null;
  return APP_LABELS[app] ?? app;
}
