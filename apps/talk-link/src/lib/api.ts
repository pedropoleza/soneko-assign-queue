import { API_URL, getSecret } from './config';
import type { AppState, Link, LinkDetail, Partner, PartnerDetail, Template } from '@/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const secret = getSecret();
  if (!secret) throw new ApiError('missing_secret', 401);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }

  if (!res.ok) {
    const err = (data as { error?: string } | null)?.error;
    throw new ApiError(err ?? `http_${res.status}`, res.status);
  }
  return data as T;
}

export type LinkInput = {
  id?: string;
  partner_id?: string | null;
  partner_name?: string | null;
  partner_kind?: string;
  name: string;
  slug?: string;
  destination_phone?: string;
  message: string;
  code_mode?: string;
  objective?: string | null;
  tone?: string | null;
  language?: string;
  lead_name?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  active?: boolean;
};

export const api = {
  state: (days = 30) => call<AppState>('GET', `/state?days=${days}`),
  linkDetail: (id: string, days = 30) => call<LinkDetail>('GET', `/link/${id}?days=${days}`),
  partnerDetail: (id: string, months = 6) => call<PartnerDetail>('GET', `/partner/${id}?months=${months}`),
  checkSlug: (slug: string) =>
    call<{ available: boolean; reason?: string; slug?: string }>(
      'GET',
      `/slug-check?slug=${encodeURIComponent(slug)}`,
    ),

  compose: (input: { message: string; code?: string; code_mode?: string; destination_phone?: string }) =>
    call<{
      message: string;
      stamped_message: string;
      whatsapp_url: string;
      invisible_chars: number;
    }>('POST', '/compose', input),

  saveLink: (input: LinkInput) => call<Link>('POST', '/links', input),
  deleteLink: (id: string) => call<{ ok: true }>('DELETE', `/links/${id}`),

  savePartner: (input: Partial<Partner> & { name: string }) => call<Partner>('POST', '/partners', input),
  deletePartner: (id: string) => call<{ ok: true }>('DELETE', `/partners/${id}`),

  saveTemplate: (input: Partial<Template> & { name: string; body: string }) =>
    call<Template>('POST', '/templates', input),
  deleteTemplate: (id: string) => call<{ ok: true }>('DELETE', `/templates/${id}`),

  saveSettings: (input: { whatsapp_phone?: string; short_domain?: string; name?: string }) =>
    call<{ ok: true; whatsapp_phone: string; short_domain: string }>('POST', '/settings', input),
};
