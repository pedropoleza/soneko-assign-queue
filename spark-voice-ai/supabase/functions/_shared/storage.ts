// Storage dos MP3 (Etapa 3 / D6 = bucket privado + URL assinada com expiração).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 dias

function bucket(): string {
  return Deno.env.get('STORAGE_BUCKET_NAME') ?? 'spark-audio';
}

/** Faz upload do MP3 e devolve o caminho + URL assinada. */
export async function uploadAudio(
  db: SupabaseClient,
  accountId: string,
  generationId: string,
  bytes: Uint8Array,
): Promise<{ path: string; url: string }> {
  const path = `${accountId}/${generationId}.mp3`;
  const { error } = await db.storage.from(bucket()).upload(path, bytes, {
    contentType: 'audio/mpeg',
    upsert: true,
  });
  if (error) throw new Error(`storage_upload:${error.message}`);

  const { data, error: signErr } = await db.storage.from(bucket()).createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !data) throw new Error(`storage_sign:${signErr?.message ?? 'unknown'}`);
  return { path, url: data.signedUrl };
}
