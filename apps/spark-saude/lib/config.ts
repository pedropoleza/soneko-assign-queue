/**
 * Server-side configuration. This module must only be imported from server
 * code (route handlers / lib/ghl). It reads secrets from the environment;
 * nothing here is ever sent to the browser.
 */

export const serverEnv = {
  ghlApiBase: (process.env.GHL_API_BASE || "https://services.leadconnectorhq.com").replace(/\/+$/, ""),
  ghlApiVersion: process.env.GHL_API_VERSION || "2021-07-28",
  // Base of the GHL app UI (for deep links to contacts). White-label configurable.
  ghlAppBase: (process.env.GHL_APP_BASE || "https://app.gohighlevel.com").replace(/\/+$/, ""),
  locationId: process.env.GHL_LOCATION_ID || "",

  accessToken: process.env.GHL_ACCESS_TOKEN || "",
  refreshToken: process.env.GHL_REFRESH_TOKEN || "",
  clientId: process.env.GHL_CLIENT_ID || "",
  clientSecret: process.env.GHL_CLIENT_SECRET || "",

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // --- Cotação Leão (CMS Marketplace) ---
  // Key expires every 60 days; rotating it is just updating this env (no deploy).
  cmsApiKey: process.env.CMS_MARKETPLACE_API_KEY || "",
  cmsApiBase: (process.env.CMS_API_BASE || "https://marketplace.api.healthcare.gov/api/v1").replace(/\/+$/, ""),
  // Public base URL of this app — used to build the proposal share links.
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, ""),
  // HMAC secret that signs the public proposal tokens.
  proposalTokenSecret: process.env.PROPOSAL_TOKEN_SECRET || "",
  // Reads the plan screenshots the broker already takes (lib/cotacao/extract.ts).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  // Contact↔contact association used to link household members (lib/ghl/associations.ts).
  ghlAssociationKey: process.env.GHL_ASSOCIATION_KEY || "familiar",

  useFixtures: (process.env.GHL_USE_FIXTURES || "false").toLowerCase() === "true",
};

/**
 * The active location for this request. V1 is single-tenant (Dani), resolved
 * from env; the signature keeps a locationId param so multi-tenant routing can
 * be layered on without touching callers.
 */
export function resolveLocationId(explicit?: string | null): string {
  const id = (explicit || serverEnv.locationId || "").trim();
  return id;
}

/** Default tag / stage semantics — overridable per tenant via Supabase config. */
export const DEFAULTS = {
  linhaTag: "linha_saude",
  renewalTags: { avisado: "renovacao_avisada", pendente: "renovacao_pendente", feito: "renovacao_feita", naoRenovou: "nao_renovou" },
  attentionTags: ["requer_atencao", "informacao_pendente", "documento_pendente"],
  overviewTags: {
    activeClients: "cliente_ativo",
    applicationsInProgress: "aplicacao_iniciada",
    awaitingApproval: "aplicacao_em_analise",
  },
} as const;
