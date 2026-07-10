// spark-api — backend do painel (Etapas 1/2/3/4). Autenticado por session token
// (x-spark-session) emitido no OAuth. Todo acesso é filtrado por account_id.
import { z } from 'https://esm.sh/zod@3.23.8';
import { serviceClient } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';
import { verifySession } from '../_shared/session.ts';
import { renderTemplate, validateTemplate } from '../_shared/template-engine.ts';
import { checkContentPolicy, sanitizeText } from '../_shared/content-policy.ts';
import { cloneVoice, estimateCost, synthesize } from '../_shared/elevenlabs.ts';
import { uploadAudio } from '../_shared/storage.ts';
import { currentMonthUsage } from '../_shared/usage.ts';
import { loadConfig } from '../_shared/config.ts';
import { applyCredit, getBalance, priceFor } from '../_shared/credits.ts';
import { getAccessToken, getSnippets, searchContacts, updateContactDob } from '../_shared/ghl.ts';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:.*;base64,/, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Próxima ocorrência (aniversário) de uma data YYYY-MM-DD a partir de hoje.
function nextBirthday(dob: string): string {
  const [, m, d] = dob.split('-').map(Number);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let year = now.getUTCFullYear();
  if (Date.UTC(year, m - 1, d) < today) year++;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  const db = serviceClient();
  await loadConfig(db);
  const session = await verifySession(req.headers.get('x-spark-session'));
  if (!session) return json({ error: 'unauthorized' }, 401);
  const accountId = session.account_id;

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/spark-api/, '') || '/';
  const seg = path.split('/').filter(Boolean); // ex: ['voices','<id>']
  const method = req.method;

  const readBody = async () => {
    try {
      return await req.json();
    } catch {
      return {};
    }
  };

  try {
    // GET /state — dashboard agregado ------------------------------------------
    if (path === '/state' && method === 'GET') {
      const { data: account } = await db.from('accounts').select('*').eq('id', accountId).single();
      const { data: activeVoice } = await db
        .from('voices')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'active')
        .maybeSingle();
      const { count: templatesActive } = await db
        .from('audio_templates')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('active', true);
      const usage = await currentMonthUsage(db, accountId);
      const balance = await getBalance(db, accountId);
      const { data: lastGen } = await db
        .from('audio_generations')
        .select('id, contact_name, event_type, status, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: recentErrors } = await db
        .from('audio_generations')
        .select('id, error_message, created_at')
        .eq('account_id', accountId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5);

      return json({
        account: {
          id: account.id,
          ghl_location_id: account.ghl_location_id,
          company_name: account.company_name,
          owner_name: account.owner_name ?? null,
          status: account.status,
          credit_balance: balance,
        },
        active_voice: activeVoice ?? null,
        templates_active: templatesActive ?? 0,
        usage: {
          audios_month: usage.audios,
          characters_month: usage.characters,
          spent_month: estimateCost(usage.characters),
          credit_balance: balance,
        },
        last_generation: lastGen ?? null,
        recent_errors: recentErrors ?? [],
      });
    }

    // /voices -------------------------------------------------------------------
    if (seg[0] === 'voices' && seg.length === 1 && method === 'GET') {
      const { data } = await db.from('voices').select('*').eq('account_id', accountId).order('created_at', {
        ascending: false,
      });
      return json(data ?? []);
    }

    if (seg[0] === 'voices' && seg.length === 1 && method === 'POST') {
      const schema = z.object({
        voice_name: z.string().min(1),
        language: z.string().min(1),
        voice_owner_name: z.string().min(1),
        sample_base64: z.string().min(1),
        consent_accepted: z.literal(true),
      });
      const parsed = schema.safeParse(await readBody());
      if (!parsed.success) return json({ error: 'invalid_payload', detail: parsed.error.flatten() }, 400);
      const b = parsed.data;

      const { voiceId } = await cloneVoice(b.voice_name, b64ToBytes(b.sample_base64));
      // desativa vozes anteriores (uma ativa por conta)
      await db.from('voices').update({ status: 'inactive' }).eq('account_id', accountId).eq('status', 'active');
      const { data, error } = await db
        .from('voices')
        .insert({
          account_id: accountId,
          provider: 'elevenlabs',
          provider_voice_id: voiceId,
          voice_name: b.voice_name,
          language: b.language,
          status: 'active',
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
          consent_ip: req.headers.get('x-forwarded-for'),
          consent_user_agent: req.headers.get('user-agent'),
          voice_owner_name: b.voice_owner_name,
        })
        .select()
        .single();
      if (error) return json({ error: 'voice_insert_failed', detail: error.message }, 500);
      return json(data);
    }

    if (seg[0] === 'voices' && seg.length === 2 && method === 'PATCH') {
      const b = await readBody();
      const { data, error } = await db
        .from('voices')
        .update({ status: b.status })
        .eq('id', seg[1])
        .eq('account_id', accountId)
        .select()
        .single();
      if (error) return json({ error: 'voice_update_failed' }, 500);
      return json(data);
    }

    if (seg[0] === 'voices' && seg.length === 2 && method === 'DELETE') {
      await db.from('voices').delete().eq('id', seg[1]).eq('account_id', accountId);
      return json({ ok: true });
    }

    // /templates ----------------------------------------------------------------
    if (seg[0] === 'templates' && seg.length === 1 && method === 'GET') {
      const { data } = await db
        .from('audio_templates')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });
      return json(data ?? []);
    }

    if (seg[0] === 'templates' && seg.length === 1 && method === 'POST') {
      const b = await readBody();
      const v = validateTemplate(b.template_text ?? '');
      if (!v.ok) return json({ error: 'invalid_template', detail: v.errors }, 400);
      const { data, error } = await db
        .from('audio_templates')
        .insert({
          account_id: accountId,
          name: b.name,
          event_type: b.event_type,
          language: b.language,
          tone: b.tone ?? null,
          template_text: b.template_text,
        })
        .select()
        .single();
      if (error) return json({ error: 'template_insert_failed' }, 500);
      return json(data);
    }

    if (seg[0] === 'templates' && seg.length === 2 && method === 'PATCH') {
      const b = await readBody();
      if (b.template_text) {
        const v = validateTemplate(b.template_text);
        if (!v.ok) return json({ error: 'invalid_template', detail: v.errors }, 400);
      }
      const { data, error } = await db
        .from('audio_templates')
        .update(b)
        .eq('id', seg[1])
        .eq('account_id', accountId)
        .select()
        .single();
      if (error) return json({ error: 'template_update_failed' }, 500);
      return json(data);
    }

    if (seg[0] === 'templates' && seg.length === 2 && method === 'DELETE') {
      await db.from('audio_templates').delete().eq('id', seg[1]).eq('account_id', accountId);
      return json({ ok: true });
    }

    // /audio/preview — texto final sem TTS -------------------------------------
    if (path === '/audio/preview' && method === 'POST') {
      const b = await readBody();
      const { data: tpl } = await db
        .from('audio_templates')
        .select('*')
        .eq('id', b.template_id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!tpl) return json({ error: 'template_not_found' }, 404);
      const vars = b.sample_name ? { first_name: b.sample_name, full_name: b.sample_name } : {};
      const rendered = renderTemplate(tpl.template_text, vars);
      const finalText = sanitizeText(rendered.text);
      const policy = checkContentPolicy(finalText);
      return json({ final_text: finalText, characters: finalText.length, policy });
    }

    // /audio/test — geração real de teste --------------------------------------
    if (path === '/audio/test' && method === 'POST') {
      const b = await readBody();
      const { data: tpl } = await db
        .from('audio_templates')
        .select('*')
        .eq('id', b.template_id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!tpl) return json({ error: 'template_not_found' }, 404);
      const { data: voice } = await db
        .from('voices')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'active')
        .maybeSingle();
      if (!voice) return json({ error: 'no_active_voice' }, 409);

      const vars = b.sample_name ? { first_name: b.sample_name, full_name: b.sample_name } : {};
      const finalText = sanitizeText(renderTemplate(tpl.template_text, vars).text);
      if (!finalText) return json({ error: 'empty_final_text' }, 422);
      const policy = checkContentPolicy(finalText);
      if (!policy.ok) return json({ error: 'content_policy_violation', violations: policy.violations }, 422);

      const price = priceFor(finalText.length);
      const balance = await getBalance(db, accountId);
      if (balance < price) return json({ error: 'insufficient_credits', balance, price }, 402);

      const { data: gen } = await db
        .from('audio_generations')
        .insert({
          account_id: accountId,
          template_id: tpl.id,
          voice_id: voice.id,
          event_type: tpl.event_type,
          contact_name: b.sample_name ?? 'Teste',
          final_text: finalText,
          characters_used: finalText.length,
          estimated_cost: estimateCost(finalText.length),
          status: 'processing',
          is_test: true,
        })
        .select()
        .single();

      try {
        const mp3 = await synthesize(voice.provider_voice_id, finalText);
        const { path: sp, url } = await uploadAudio(db, accountId, gen.id, mp3);
        await db.from('audio_generations').update({ status: 'completed', audio_url: url, storage_path: sp }).eq(
          'id',
          gen.id,
        );
        await db.from('usage_logs').insert({
          account_id: accountId,
          generation_id: gen.id,
          characters_used: finalText.length,
          event_type: tpl.event_type,
        });
        const newBalance = await applyCredit(db, accountId, -price, 'debit', `Teste ${tpl.event_type}`, gen.id);
        return json({ ...gen, status: 'completed', audio_url: url, storage_path: sp, charged: price, balance: newBalance });
      } catch (e) {
        await db.from('audio_generations').update({ status: 'failed', error_message: String(e).slice(0, 500) }).eq(
          'id',
          gen.id,
        );
        return json({ error: 'generation_failed', generationId: gen.id }, 502);
      }
    }

    // /generations — histórico --------------------------------------------------
    if (seg[0] === 'generations' && method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
      const { data } = await db
        .from('audio_generations')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return json(data ?? []);
    }

    // /snippets — snippets/valores reutilizáveis da location (GHL) -------------
    if (seg[0] === 'snippets' && method === 'GET') {
      const { data: acc } = await db.from('accounts').select('ghl_location_id').eq('id', accountId).single();
      const token = await getAccessToken(db, accountId);
      if (!token || !acc) return json([]);
      return json(await getSnippets(token, acc.ghl_location_id));
    }

    // /contacts — busca por nome na location + correção de Date of Birth -------
    if (seg[0] === 'contacts' && seg.length === 1 && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const { data: acc } = await db.from('accounts').select('ghl_location_id').eq('id', accountId).single();
      const token = await getAccessToken(db, accountId);
      if (!token || !acc) return json([]);
      return json(await searchContacts(token, acc.ghl_location_id, q));
    }

    if (seg[0] === 'contacts' && seg.length === 2 && method === 'PATCH') {
      const b = await readBody();
      if (!b.dob || !/^\d{4}-\d{2}-\d{2}$/.test(b.dob)) return json({ error: 'invalid_dob' }, 400);
      const token = await getAccessToken(db, accountId);
      if (!token) return json({ error: 'no_ghl_token' }, 401);
      const ok = await updateContactDob(token, seg[1], b.dob);
      if (!ok) return json({ error: 'contact_update_failed' }, 502);
      // reflete a correção em envios pendentes deste contato
      await db
        .from('audio_sends')
        .update({ dob: b.dob, send_date: nextBirthday(b.dob), status: 'scheduled' })
        .eq('account_id', accountId)
        .eq('contact_id', seg[1])
        .eq('status', 'missing_dob');
      return json({ ok: true, dob: b.dob });
    }

    // /sends — agendamento de envios de áudio -----------------------------------
    if (seg[0] === 'sends' && seg.length === 1 && method === 'GET') {
      const { data } = await db
        .from('audio_sends')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      return json(data ?? []);
    }

    if (seg[0] === 'sends' && seg.length === 1 && method === 'POST') {
      const b = await readBody();
      const items = Array.isArray(b.contacts) ? b.contacts : [];
      if (!items.length) return json({ error: 'no_contacts' }, 400);
      const rows = items.map((c: { contact_id?: string; contact_name?: string; contact_phone?: string; dob?: string }) => {
        const dob = typeof c.dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.dob) ? c.dob : null;
        return {
          account_id: accountId,
          template_id: b.template_id ?? null,
          event_type: b.event_type ?? null,
          contact_id: String(c.contact_id ?? ''),
          contact_name: c.contact_name ?? null,
          contact_phone: c.contact_phone ?? null,
          dob,
          send_date: dob ? nextBirthday(dob) : null,
          status: dob ? 'scheduled' : 'missing_dob',
        };
      }).filter((r: { contact_id: string }) => r.contact_id);
      if (!rows.length) return json({ error: 'no_contacts' }, 400);
      const { data, error } = await db.from('audio_sends').insert(rows).select();
      if (error) return json({ error: 'sends_insert_failed', detail: error.message }, 500);
      return json({
        ok: true,
        sends: data,
        scheduled: rows.filter((r: { status: string }) => r.status === 'scheduled').length,
        missing: rows.filter((r: { status: string }) => r.status === 'missing_dob').length,
      });
    }

    if (seg[0] === 'sends' && seg.length === 2 && method === 'DELETE') {
      await db
        .from('audio_sends')
        .update({ status: 'cancelled' })
        .eq('id', seg[1])
        .eq('account_id', accountId)
        .in('status', ['scheduled', 'missing_dob']);
      return json({ ok: true });
    }

    // /credits — saldo + extrato (Billing) ------------------------------------
    if (seg[0] === 'credits' && method === 'GET') {
      const balance = await getBalance(db, accountId);
      const { data: tx } = await db
        .from('credit_transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50);
      return json({ balance, transactions: tx ?? [] });
    }

    return json({ error: 'not_found', path }, 404);
  } catch (e) {
    return json({ error: 'internal_error', detail: String(e).slice(0, 300) }, 500);
  }
});
