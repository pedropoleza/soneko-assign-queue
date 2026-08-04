import { resolveLocationId, serverEnv } from "@/lib/config";
import { syncOpportunityPhones } from "@/lib/ghl/opportunity-phone";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Varredura + escrita numa conta inteira: o padrão de 10s não basta.
export const maxDuration = 300;

/**
 * Espelho do telefone do contato no campo da oportunidade.
 *
 * GET  — é o que o cron da Vercel chama (crons só fazem GET).
 * POST — o mesmo, para disparo manual pelo dashboard.
 *
 * `?dryRun=1` lista o que mudaria sem escrever nada. Use antes da primeira
 * execução real numa conta nova.
 */
async function run(req: Request) {
  try {
    // O cron da Vercel manda `Authorization: Bearer $CRON_SECRET`. Fora do cron,
    // aceitamos o mesmo segredo em `?secret=` para disparo manual. Sem segredo
    // configurado, a rota só responde em dry-run — nunca escreve às cegas.
    const url = new URL(req.url);
    const dryRun = ["1", "true"].includes((url.searchParams.get("dryRun") || "").toLowerCase());
    const provided =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      url.searchParams.get("secret") ||
      "";
    const authorized = Boolean(serverEnv.cronSecret) && provided === serverEnv.cronSecret;

    if (!dryRun && !authorized) {
      return jsonError(new Error("Não autorizado. Envie o CRON_SECRET, ou use ?dryRun=1 para simular."));
    }
    // Ambiente de fixtures lê dados falsos mas escreveria no CRM de verdade —
    // a leitura desta rota não passa pela camada de fixtures. Só simula.
    if (!dryRun && serverEnv.useFixtures) {
      return jsonError(new Error("GHL_USE_FIXTURES está ligado: só dry-run neste ambiente."));
    }

    const result = await syncOpportunityPhones({
      locationId: resolveLocationId(locationFromRequest(req)),
      dryRun,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = run;
export const POST = run;
