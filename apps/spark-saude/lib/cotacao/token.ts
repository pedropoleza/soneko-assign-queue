import crypto from "node:crypto";
import { serverEnv } from "@/lib/config";

/**
 * Signed tokens for the public proposal links (CLAUDE.md §6). A token carries the
 * quote id and an expiry, HMAC-signed with PROPOSAL_TOKEN_SECRET — so a link
 * can't be forged or read past its expiry without hitting the DB. The DB row also
 * stores token_expires_at as the authoritative check; this is the cheap gate.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 */

interface TokenPayload {
  quoteId: string;
  /** Unix seconds. */
  exp: number;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function secret(): string {
  if (!serverEnv.proposalTokenSecret) {
    throw new Error("PROPOSAL_TOKEN_SECRET não configurada — necessária para assinar os links de proposta.");
  }
  return serverEnv.proposalTokenSecret;
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

/** Sign a proposal token valid for `ttlDays` (default 30, §6). */
export function signProposalToken(quoteId: string, ttlDays = 30): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload = b64url(JSON.stringify({ quoteId, exp } satisfies TokenPayload));
  const token = `${payload}.${sign(payload)}`;
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Verify a token's signature and expiry. Returns the quoteId or throws. */
export function verifyProposalToken(token: string): { quoteId: string; expired: boolean } {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("Token de proposta inválido.");

  const expected = sign(payload);
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Assinatura do token inválida.");

  const data = JSON.parse(fromB64url(payload).toString("utf8")) as TokenPayload;
  return { quoteId: data.quoteId, expired: data.exp * 1000 < Date.now() };
}
