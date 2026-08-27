export type CodeMode = 'invisible' | 'discreet' | 'visible' | 'none';
export type PartnerKind = 'influencer' | 'store' | 'partner' | 'other';
export type Language = 'pt' | 'en' | 'es';
export type Tone = 'amigavel' | 'profissional' | 'direto';

export type Partner = {
  id: string;
  account_id: string;
  name: string;
  kind: PartnerKind;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  links: number;
  clicks: number;
  sends: number;
};

export type Link = {
  id: string;
  account_id: string;
  partner_id: string | null;
  partner_name: string | null;
  partner_kind: PartnerKind | null;
  slug: string;
  code: string;
  code_mode: CodeMode;
  name: string;
  destination_phone: string;
  message: string;
  objective: string | null;
  tone: Tone | null;
  language: Language;
  lead_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;

  // decorados pela API
  short_url: string;
  whatsapp_preview: string;
  clicks: number;
  clicks_window: number;
  sends: number;
  sends_window: number;
  last_click_at: string | null;
  last_send_at: string | null;
};

export type Template = {
  id: string;
  name: string;
  body: string;
  objective: string | null;
  tone: Tone | null;
  language: Language;
  created_at: string;
};

export type Send = {
  id: string;
  occurred_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  ghl_contact_id: string | null;
  matched_by: string;
  confidence: number;
  crm_synced: boolean;
  link_id: string | null;
  link_name: string | null;
  link_slug: string | null;
  partner_name: string | null;
  message_body: string;
};

export type Click = {
  id: string;
  clicked_at: string;
  device: string | null;
  country: string | null;
  city: string | null;
  converted: boolean;
  link_name: string;
  link_slug: string;
  partner_name: string | null;
};

export type SeriesPoint = { day: string; clicks: number; sends: number };

export type AppState = {
  account: {
    id: string;
    ghl_location_id: string;
    name: string;
    whatsapp_phone: string;
    short_domain: string;
    settings: Record<string, unknown>;
  };
  window_days: number;
  partners: Partner[];
  links: Link[];
  templates: Template[];
  recent_sends: Send[];
  recent_clicks: Click[];
  series: SeriesPoint[];
  totals: {
    links: number;
    partners: number;
    clicks: number;
    clicks_prev: number;
    sends: number;
    sends_prev: number;
    unique_clicks: number;
    bots: number;
    last_event_at: string | null;
  };
  sources: {
    by_src: Array<{ src: string; clicks: number; sends: number }>;
    by_medium: Array<{ medium: string; clicks: number }>;
    by_content: Array<{ content: string; clicks: number; sends: number }>;
  };
  signals?: Signals;
};

/** Leituras que o relatório não fazia: o que parou, o que é ruído, quem evoluiu. */
export type Signals = {
  window_days: number;
  stale_days: number;
  alerts: Array<{
    kind: 'sem_entrada' | 'nunca_clicado' | 'sem_envio';
    severity: string;
    link_id: string;
    link_name: string;
    link_slug: string;
    partner_name: string | null;
    last_click_at: string | null;
    clicks_window: number;
    sends_window: number;
    days_quiet: number | null;
  }>;
  quality: Array<{
    link_id: string;
    link_name: string;
    link_slug: string;
    partner_name: string | null;
    clicks: number;
    uniques: number;
    top_ip_clicks: number;
    no_ip: number;
    concentration: number | null;
    suspect: boolean;
  }>;
  trend: Array<{
    partner_id: string;
    partner_name: string;
    clicks: number;
    clicks_prev: number;
    delta_clicks: number;
    sends: number;
    sends_prev: number;
    delta_sends: number;
    pct_sends: number | null;
    pct_clicks: number | null;
  }>;
};

export type LinkDetail = {
  link: Link;
  series: SeriesPoint[];
  by_device: Array<{ device: string; count: number }>;
  by_app: Array<{ app: string; count: number }>;
  by_region: Array<{ country: string | null; region: string | null; count: number }>;
  clicks: Array<{
    id: string;
    clicked_at: string;
    device: string | null;
    os: string | null;
    browser: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    referer: string | null;
    app: string | null;
    app_opened: boolean;
    converted_at: string | null;
  }>;
  sends: Array<{
    id: string;
    occurred_at: string;
    contact_name: string | null;
    contact_phone: string | null;
    ghl_contact_id: string | null;
    matched_by: string;
    confidence: number;
    crm_synced: boolean;
    message_body: string;
  }>;
};

export type MonthPoint = { month: string; clicks: number; sends: number };

export type PartnerDetail = {
  partner: {
    id: string;
    name: string;
    kind: PartnerKind;
    handle: string | null;
    active: boolean;
    created_at: string;
  };
  totals: {
    links: number;
    clicks: number;
    sends: number;
    first_at: string | null;
    last_at: string | null;
  };
  by_month: MonthPoint[];
  links: Array<{
    id: string;
    name: string;
    slug: string;
    code: string;
    created_at: string;
    active: boolean;
    clicks: number;
    sends: number;
    last_click_at: string | null;
    by_month: MonthPoint[];
    short_url: string;
  }>;
};
