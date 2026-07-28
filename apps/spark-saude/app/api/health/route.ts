import { serverEnv } from "@/lib/config";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment readiness at a glance.
 *
 * Booleans only: it reports WHETHER each integration is configured, never the
 * values. Use it right after a deploy to confirm the environment is complete
 * before handing the URL to anyone — a missing PROPOSAL_TOKEN_SECRET or an
 * unconfigured database only shows up mid-flow otherwise.
 */
export async function GET() {
  const checks = {
    ghl: {
      configured: Boolean(serverEnv.accessToken && serverEnv.locationId),
      usingFixtures: serverEnv.useFixtures,
    },
    database: {
      // Required in production: without it a generated proposal link cannot be read back.
      configured: Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceKey),
    },
    proposalLinks: {
      // Required to sign /proposta/<token> links.
      configured: Boolean(serverEnv.proposalTokenSecret),
      appUrlConfigured: Boolean(serverEnv.appUrl),
    },
    cmsMarketplace: {
      // Without it the quote falls back to fixture plans (flagged in the UI).
      configured: Boolean(serverEnv.cmsApiKey),
    },
  };

  const blocking = [
    !checks.database.configured && "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    !checks.proposalLinks.configured && "PROPOSAL_TOKEN_SECRET",
  ].filter(Boolean) as string[];

  const degraded = [
    !checks.cmsMarketplace.configured && "CMS_MARKETPLACE_API_KEY (planos de exemplo)",
    !checks.proposalLinks.appUrlConfigured && "NEXT_PUBLIC_APP_URL (link montado pelo browser)",
    checks.ghl.usingFixtures && "GHL_USE_FIXTURES=true (dados de exemplo)",
  ].filter(Boolean) as string[];

  return jsonOk({
    status: blocking.length ? "incomplete" : degraded.length ? "degraded" : "ready",
    checks,
    missingRequired: blocking,
    warnings: degraded,
  });
}
