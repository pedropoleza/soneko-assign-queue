// Tipos do banco (schema `spark`) — derivados das migrations 0001/0002.

export type AccountStatus = 'active' | 'suspended' | 'cancelled';
export type VoiceStatus = 'active' | 'inactive';
export type GenerationStatus = 'processing' | 'completed' | 'failed';

export type Voice = {
  id: string;
  account_id: string;
  provider: string;
  provider_voice_id: string;
  voice_name: string;
  language: string;
  status: VoiceStatus;
  consent_accepted: boolean;
  consent_accepted_at: string | null;
  consent_ip: string | null;
  consent_user_agent: string | null;
  voice_owner_name: string;
  created_at: string;
  updated_at: string;
};

export type AudioTemplate = {
  id: string;
  account_id: string;
  name: string;
  event_type: string;
  language: string;
  tone: string | null;
  template_text: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AudioGeneration = {
  id: string;
  account_id: string;
  contact_id: string | null;
  template_id: string | null;
  voice_id: string | null;
  event_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  final_text: string;
  audio_url: string | null;
  storage_path: string | null;
  provider: string;
  characters_used: number | null;
  estimated_cost: number | null;
  status: GenerationStatus;
  error_message: string | null;
  is_test: boolean;
  created_at: string;
  // devolvidos pelo /audio/test após débito de crédito
  charged?: number;
  balance?: number;
};

// Snippet vindo da location no GoHighLevel.
export type Snippet = { id: string; name: string; body: string };

export type CreditKind = 'topup' | 'debit' | 'adjustment';
export type CreditTx = {
  id: string;
  kind: CreditKind;
  amount: number;
  balance_after: number;
  description: string | null;
  generation_id: string | null;
  created_at: string;
};

// Estado agregado do painel (endpoint /state).
export type AppState = {
  account: {
    id: string;
    ghl_location_id: string;
    company_name: string;
    owner_name: string | null;
    status: AccountStatus;
    credit_balance: number;
  };
  active_voice: Voice | null;
  templates_active: number;
  usage: {
    audios_month: number;
    characters_month: number;
    spent_month: number;
    credit_balance: number;
  };
  last_generation: Pick<AudioGeneration, 'id' | 'contact_name' | 'event_type' | 'status' | 'created_at'> | null;
  recent_errors: Array<Pick<AudioGeneration, 'id' | 'error_message' | 'created_at'>>;
};

// Allow-list de variáveis suportadas no MVP (seção 2.5).
export const ALLOWED_VARIABLES = [
  'first_name',
  'full_name',
  'phone',
  'email',
  'business_name',
  'user_name',
  'appointment_date',
  'appointment_time',
  'pipeline_stage',
  'custom_service',
] as const;

export type AllowedVariable = (typeof ALLOWED_VARIABLES)[number];

// Conversão dos merge fields do GHL para a allow-list do Spark.
export const GHL_FIELD_MAP: Array<[RegExp, string]> = [
  [/\{\{\s*contact\.first_name\s*\}\}/g, '{{first_name}}'],
  [/\{\{\s*contact\.(full_name|name)\s*\}\}/g, '{{full_name}}'],
  [/\{\{\s*contact\.phone\s*\}\}/g, '{{phone}}'],
  [/\{\{\s*contact\.email\s*\}\}/g, '{{email}}'],
  [/\{\{\s*location\.name\s*\}\}/g, '{{business_name}}'],
  [/\{\{\s*user\.name\s*\}\}/g, '{{user_name}}'],
  [/\{\{\s*appointment\.start_date\s*\}\}/g, '{{appointment_date}}'],
  [/\{\{\s*appointment\.start_time\s*\}\}/g, '{{appointment_time}}'],
  [/\{\{\s*custom_values\.[a-z_]+\s*\}\}/g, '{{custom_service}}'],
];

export function mapGhlFields(text: string): string {
  return GHL_FIELD_MAP.reduce((acc, [re, to]) => acc.replace(re, to), text);
}
