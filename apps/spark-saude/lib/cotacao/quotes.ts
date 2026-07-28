import crypto from "node:crypto";
import { serverEnv } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signProposalToken, verifyProposalToken } from "./token";
import { getBrand } from "./brand";
import type { PlanOptionDraft, PublicProposal, Quote, QuoteOption, QuoteProfile } from "./types";

/**
 * Persistence facade for cotações (CLAUDE.md §5). Production reads/writes the
 * isolated `spark_cotacao` schema through SECURITY DEFINER RPCs (see
 * lib/db/schema.cotacao.sql), mirroring how spark_saude is accessed. When
 * Supabase isn't configured (dev / review), it falls back to an in-memory store
 * so the whole flow is demoable — that store is per-process and NOT durable.
 */

const MEM = new Map<string, Quote>();

/**
 * The in-memory store is a DEV convenience only. On a serverless deploy each
 * request can land on a different instance, so a quote written to memory is
 * effectively gone by the time the client opens its proposal link — the link
 * would 404 and the broker would only find out from the client. Better to
 * refuse the write with an actionable message than to hand out a dead link.
 */
function persistenceMode(): "db" | "memory" {
  if (supabaseAdmin()) return "db";
  if (isServerlessRuntime()) {
    throw new Error(
      "Persistência não configurada: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. " +
        "Sem banco, o link da proposta não sobrevive entre requisições.",
    );
  }
  return "memory";
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

export interface CreateQuoteInput {
  profile: QuoteProfile;
  options: PlanOptionDraft[];
  corretoraId: string;
  householdJson: unknown;
  ttlDays?: number;
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const id = crypto.randomUUID();
  const { token, expiresAt } = signProposalToken(id, input.ttlDays ?? 30);
  const now = new Date().toISOString();

  const options: QuoteOption[] = input.options.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    quoteId: id,
    printUrl: p.printUrl ?? null,
    response: null,
  }));

  const quote: Quote = {
    id,
    ghlContactId: input.profile.contactId ?? null,
    corretoraId: input.corretoraId,
    createdAt: now,
    zipcode: input.profile.zipcode,
    state: input.profile.state,
    countyfips: input.profile.countyfips ?? null,
    income: input.profile.income,
    year: input.profile.year,
    status: "rascunho",
    proposalToken: token,
    tokenExpiresAt: expiresAt,
    householdJson: input.householdJson,
    options,
  };

  if (persistenceMode() === "db") {
    const db = supabaseAdmin()!;
    const { error } = await db.rpc("spark_cotacao_create_quote", { p_quote: quote });
    if (error) throw new Error(`Falha ao salvar cotação: ${error.message}`);
  } else {
    MEM.set(id, quote);
  }
  return quote;
}

export async function getQuote(id: string): Promise<Quote | null> {
  if (persistenceMode() === "db") {
    const db = supabaseAdmin()!;
    const { data, error } = await db.rpc("spark_cotacao_get_quote", { p_id: id });
    if (error) throw new Error(`Falha ao ler cotação: ${error.message}`);
    return (data ?? null) as Quote | null;
  }
  return MEM.get(id) ?? null;
}

/** Public proposal by token (Ponta B). Verifies signature + expiry. */
export async function getProposalByToken(token: string): Promise<PublicProposal | null> {
  const { quoteId, expired } = verifyProposalToken(token);
  const quote = await getQuote(quoteId);
  if (!quote) return null;
  return {
    quoteId: quote.id,
    corretora: getBrand(quote.corretoraId),
    createdAt: quote.createdAt,
    year: quote.year,
    expired,
    options: quote.options,
  };
}

export async function recordResponse(args: {
  quoteOptionId: string;
  decisao: "aprovado" | "recusado";
  comentario?: string;
  ipHash?: string;
}): Promise<{ ok: true }> {
  if (persistenceMode() === "db") {
    const db = supabaseAdmin()!;
    const { error } = await db.rpc("spark_cotacao_record_response", {
      p_option_id: args.quoteOptionId,
      p_decisao: args.decisao,
      p_comentario: args.comentario ?? null,
      p_ip_hash: args.ipHash ?? null,
    });
    if (error) throw new Error(`Falha ao registrar resposta: ${error.message}`);
    return { ok: true };
  }

  // In-memory: stamp the response onto the option.
  for (const quote of MEM.values()) {
    const opt = quote.options.find((o) => o.id === args.quoteOptionId);
    if (opt) {
      opt.response = {
        id: crypto.randomUUID(),
        quoteOptionId: opt.id,
        decisao: args.decisao,
        comentario: args.comentario ?? null,
        respondidoEm: new Date().toISOString(),
      };
      quote.status = "respondida";
      return { ok: true };
    }
  }
  return { ok: true };
}

/** Absolute share URL for a proposal token. */
export function proposalUrl(token: string): string {
  const base = serverEnv.appUrl || "";
  return `${base}/proposta/${token}`;
}
