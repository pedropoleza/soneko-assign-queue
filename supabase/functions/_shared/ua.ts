// Parsing bem enxuto de user-agent — o suficiente para segmentar cliques
// e, principalmente, separar tráfego humano de crawler.

const BOT_RE =
  /bot|crawler|spider|crawl|slurp|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|twitterbot|embedly|quora link preview|pinterest|slackbot|vkshare|redditbot|applebot|bingpreview|headlesschrome|lighthouse|curl|wget|python-requests|axios|go-http-client|okhttp/i;

export type UaInfo = {
  device: 'mobile' | 'tablet' | 'desktop' | 'bot';
  os: string | null;
  browser: string | null;
  isBot: boolean;
};

export function parseUa(ua: string | null): UaInfo {
  if (!ua) return { device: 'desktop', os: null, browser: null, isBot: false };

  // O fetcher de preview do WhatsApp bate no link antes da pessoa abrir —
  // contar isso como clique inflaria a métrica.
  if (BOT_RE.test(ua)) return { device: 'bot', os: null, browser: null, isBot: true };

  const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua);
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua);

  let os: string | null = null;
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser: string | null = null;
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return {
    device: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    os,
    browser,
    isBot: false,
  };
}

export async function hashIp(ip: string | null, salt: string): Promise<string | null> {
  if (!ip) return null;
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
