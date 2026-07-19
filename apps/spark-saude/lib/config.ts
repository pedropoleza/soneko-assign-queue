/**
 * Server-side configuration. This module must only be imported from server
 * code (route handlers / lib/ghl). It reads secrets from the environment;
 * nothing here is ever sent to the browser.
 */

export const serverEnv = {
  ghlApiBase: (process.env.GHL_API_BASE || "https://services.leadconnectorhq.com").replace(/\/+$/, ""),
  ghlApiVersion: process.env.GHL_API_VERSION || "2021-07-28",
  locationId: process.env.GHL_LOCATION_ID || "",

  accessToken: process.env.GHL_ACCESS_TOKEN || "",
  refreshToken: process.env.GHL_REFRESH_TOKEN || "",
  clientId: process.env.GHL_CLIENT_ID || "",
  clientSecret: process.env.GHL_CLIENT_SECRET || "",

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

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
