import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Print upload (CLAUDE.md §6). The print is a visual backup, not the source of
 * truth. It goes to a PRIVATE Supabase Storage bucket and is served through a
 * time-limited signed URL — never public, never indexed. Sensitive data (name,
 * income, sometimes part of an SSN) can appear on these screenshots.
 *
 * Dev / no-Supabase fallback returns an inline data URL so the flow is demoable
 * without storage configured. Production requires the `cotacao-prints` bucket
 * (private) to exist.
 */

const BUCKET = "cotacao-prints";
const SIGNED_TTL = 60 * 60 * 24 * 30; // 30 days, aligned with the proposal token

export async function uploadPrint(file: File): Promise<{ url: string; path: string | null }> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = supabaseAdmin();

  if (db) {
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type || "image/png", upsert: false });
    if (up.error) throw new Error(`Falha no upload do print: ${up.error.message}`);
    const signed = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
    if (signed.error || !signed.data) throw new Error("Falha ao assinar a URL do print.");
    return { url: signed.data.signedUrl, path };
  }

  // Dev fallback — inline, not persisted to any store.
  const b64 = Buffer.from(bytes).toString("base64");
  return { url: `data:${file.type || "image/png"};base64,${b64}`, path: null };
}

/**
 * Store the generated proposal PDF and hand back a fetchable URL.
 *
 * The URL is signed rather than public: GHL fetches it server-side to attach
 * the file to the message, and the link dies with the proposal instead of
 * leaving a client's income and household exposed on a guessable path.
 */
export async function uploadProposalPdf(
  bytes: Uint8Array,
  filename: string,
): Promise<{ url: string; path: string | null }> {
  const db = supabaseAdmin();
  if (!db) throw new Error("Supabase não configurado — necessário para gerar o PDF da proposta.");

  const safe = filename.replace(/[^\w.-]+/g, "-");
  const path = `propostas/${crypto.randomUUID()}-${safe}`;
  const up = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new Error(`Falha ao guardar o PDF: ${up.error.message}`);

  const signed = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (signed.error || !signed.data) throw new Error("Falha ao assinar a URL do PDF.");
  return { url: signed.data.signedUrl, path };
}
