import { API_URL, getSession } from './config';
import type {
  AppState,
  AudioGeneration,
  AudioSend,
  AudioTemplate,
  CreditTx,
  GhlContact,
  Snippet,
  Voice,
} from '@/types';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = getSession();
  if (!session) throw new ApiError('missing_session', 401);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-spark-session': session,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }

  if (!res.ok) {
    throw new ApiError(data?.error ?? `http_${res.status}`, res.status);
  }
  return data as T;
}

export const api = {
  getState: () => call<AppState>('GET', '/state'),

  // Vozes ---------------------------------------------------------------------
  listVoices: () => call<Voice[]>('GET', '/voices'),
  createVoice: (body: {
    voice_name: string;
    language: string;
    voice_owner_name: string;
    sample_base64: string; // Instant Voice Clone (D2)
    consent_accepted: boolean;
  }) => call<Voice>('POST', '/voices', body),
  setVoiceStatus: (id: string, status: 'active' | 'inactive') =>
    call<Voice>('PATCH', `/voices/${id}`, { status }),
  deleteVoice: (id: string) => call<{ ok: true }>('DELETE', `/voices/${id}`),

  // Templates -----------------------------------------------------------------
  listTemplates: () => call<AudioTemplate[]>('GET', '/templates'),
  createTemplate: (body: {
    name: string;
    event_type: string;
    language: string;
    tone?: string | null;
    template_text: string;
  }) => call<AudioTemplate>('POST', '/templates', body),
  updateTemplate: (id: string, body: Partial<AudioTemplate>) =>
    call<AudioTemplate>('PATCH', `/templates/${id}`, body),
  deleteTemplate: (id: string) => call<{ ok: true }>('DELETE', `/templates/${id}`),

  // Áudio ---------------------------------------------------------------------
  previewText: (body: { template_id: string; sample_name?: string }) =>
    call<{ final_text: string; characters: number }>('POST', '/audio/preview', body),
  testAudio: (body: { template_id: string; sample_name?: string }) =>
    call<AudioGeneration>('POST', '/audio/test', body),

  // Histórico / uso -----------------------------------------------------------
  listGenerations: (limit = 50) =>
    call<AudioGeneration[]>('GET', `/generations?limit=${limit}`),

  // Snippets da location (GHL). Tolerante a endpoint ainda não implementado.
  listSnippets: () => call<Snippet[]>('GET', '/snippets'),

  // Contatos da location (modal de envio) -------------------------------------
  searchContacts: (q: string) => call<GhlContact[]>('GET', `/contacts?q=${encodeURIComponent(q)}`),
  updateContactDob: (id: string, dob: string) => call<{ ok: true; dob: string }>('PATCH', `/contacts/${id}`, { dob }),

  // Envios agendados ------------------------------------------------------------
  listSends: () => call<AudioSend[]>('GET', '/sends'),
  createSends: (body: {
    template_id: string;
    event_type: string;
    contacts: Array<{ contact_id: string; contact_name?: string | null; contact_phone?: string | null; dob?: string | null }>;
  }) => call<{ ok: true; sends: AudioSend[]; scheduled: number; missing: number }>('POST', '/sends', body),
  cancelSend: (id: string) => call<{ ok: true }>('DELETE', `/sends/${id}`),

  // Créditos (Billing) --------------------------------------------------------
  listCredits: () => call<{ balance: number; transactions: CreditTx[] }>('GET', '/credits'),
};

export { ApiError };
