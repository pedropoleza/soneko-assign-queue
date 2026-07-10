// Tipos do banco (schema `spark`) — derivados da migration 0001.

export type Plan = 'starter' | 'growth' | 'agency';
export type AccountStatus = 'active' | 'suspended' | 'cancelled';
export type VoiceStatus = 'active' | 'inactive';
export type GenerationStatus = 'processing' | 'completed' | 'failed';

export type Account = {
  id: string;
  ghl_location_id: string;
  ghl_company_id: string | null;
  company_name: string;
  plan: Plan;
  monthly_audio_limit: number;
  monthly_character_limit: number;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

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
};

export type UsageSummary = {
  audios_used: number;
  audios_limit: number;
  characters_used: number;
  characters_limit: number;
  estimated_cost: number;
};

// Estado agregado que o painel consome do endpoint /state.
export type AppState = {
  account: Pick<Account, 'id' | 'ghl_location_id' | 'company_name' | 'plan' | 'status'>;
  active_voice: Voice | null;
  templates_active: number;
  usage: UsageSummary;
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
export type TemplateVars = Partial<Record<AllowedVariable, string>>;
