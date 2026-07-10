// spark-ghl-webhook — endpoint que o workflow do GHL chama em produção (Etapa 4).
// Pipeline: Zod → secret → account → status → limite → template → voz ativa →
// render → política → ElevenLabs → storage → persiste (audio_generations +
// usage_logs) → retorna audio_url + final_text + generationId.
//
// Erros são explícitos e nunca vazam a API key.
import { z } from 'https://esm.sh/zod@3.23.8';
import { serviceClient } from '../_shared/supabase.ts';
import { corsHeaders, json, preflight } from '../_shared/cors.ts';
import { rateLimit, sha256Hex, timingSafeEqual } from '../_shared/security.ts';
import { renderTemplate } from '../_shared/template-engine.ts';
import { checkContentPolicy, sanitizeText } from '../_shared/content-policy.ts';
import { estimateCost, synthesize } from '../_shared/elevenlabs.ts';
import { uploadAudio } from '../_shared/storage.ts';
import { currentMonthUsage, withinLimits } from '../_shared/usage.ts';

const PayloadSchema = z.object({
  location: z.object({ id: z.string().min(1) }),
  event_type: z.string().min(1),
  contact_id: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  vars: z.record(z.string()).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const db = serviceClient();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) return json({ error: 'invalid_payload', detail: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const locationId = body.location.id;
  if (!rateLimit(`wh:${locationId}`, 30, 60_000)) return json({ error: 'rate_limited' }, 429);

  // conta pela location
  const { data: account } = await db.from('accounts').select('*').eq('ghl_location_id', locationId).maybeSingle();
  if (!account) return json({ error: 'account_not_found' }, 404);
  if (account.status !== 'active') return json({ error: 'account_inactive' }, 403);

  // secret do webhook (header) comparado por hash
  const provided = req.headers.get('x-spark-webhook-secret') ?? '';
  const { data: secretRow } = await db
    .from('webhook_secrets')
    .select('*')
    .eq('account_id', account.id)
    .eq('active', true)
    .maybeSingle();
  if (!secretRow) return json({ error: 'no_webhook_secret' }, 401);
  const providedHash = await sha256Hex(provided);
  if (!timingSafeEqual(providedHash, secretRow.secret_hash)) return json({ error: 'invalid_secret' }, 401);

  // template ativo para o event_type
  const { data: template } = await db
    .from('audio_templates')
    .select('*')
    .eq('account_id', account.id)
    .eq('event_type', body.event_type)
    .eq('active', true)
    .maybeSingle();
  if (!template) return json({ error: 'no_template_for_event' }, 404);

  // voz ativa + consentimento
  const { data: voice } = await db
    .from('voices')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!voice) return json({ error: 'no_active_voice' }, 409);
  if (!voice.consent_accepted) return json({ error: 'voice_consent_missing' }, 409);

  // render + política
  const rendered = renderTemplate(template.template_text, body.vars ?? {});
  const finalText = sanitizeText(rendered.text);
  if (!finalText) return json({ error: 'empty_final_text' }, 422);
  const policy = checkContentPolicy(finalText);
  if (!policy.ok) return json({ error: 'content_policy_violation', violations: policy.violations }, 422);

  // gate de limite mensal
  const usage = await currentMonthUsage(db, account.id);
  const limit = withinLimits(usage, account.monthly_audio_limit, account.monthly_character_limit, finalText.length);
  if (!limit.ok) return json({ error: 'limit_exceeded', reason: limit.reason }, 429);

  // registra a geração (processing) para ter o id no caminho do storage
  const { data: gen, error: genErr } = await db
    .from('audio_generations')
    .insert({
      account_id: account.id,
      contact_id: body.contact_id ?? null,
      template_id: template.id,
      voice_id: voice.id,
      event_type: body.event_type,
      contact_name: body.contact_name ?? null,
      contact_phone: body.contact_phone ?? null,
      final_text: finalText,
      provider: 'elevenlabs',
      characters_used: finalText.length,
      estimated_cost: estimateCost(finalText.length),
      status: 'processing',
    })
    .select()
    .single();
  if (genErr || !gen) return json({ error: 'generation_insert_failed' }, 500);

  try {
    const mp3 = await synthesize(voice.provider_voice_id, finalText);
    const { path, url } = await uploadAudio(db, account.id, gen.id, mp3);

    await db
      .from('audio_generations')
      .update({ status: 'completed', audio_url: url, storage_path: path })
      .eq('id', gen.id);
    await db.from('usage_logs').insert({
      account_id: account.id,
      generation_id: gen.id,
      characters_used: finalText.length,
      provider: 'elevenlabs',
      event_type: body.event_type,
    });
    await db.from('webhook_secrets').update({ last_used_at: new Date().toISOString() }).eq('id', secretRow.id);

    return json({ generationId: gen.id, audio_url: url, final_text: finalText });
  } catch (e) {
    // não vaza a key — mensagem genérica no corpo, detalhe fica no registro
    await db
      .from('audio_generations')
      .update({ status: 'failed', error_message: String(e).slice(0, 500) })
      .eq('id', gen.id);
    return new Response(JSON.stringify({ error: 'generation_failed', generationId: gen.id }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
