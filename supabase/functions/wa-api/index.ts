// ---------------------------------------------------------------------------
// Spark Talk Link — API consumida pelo iframe.
//
// Autenticação: header `x-wa-secret` com o app_secret da location
// (entregue pelo SSO ou pelo ?secret= do Custom Menu Link).
//
//   GET    /state?days=30
//   GET    /link/:id?days=30
//   GET    /report?start=ISO&end=ISO
//   GET    /slug-check?slug=xxx
//   POST   /compose                 -> pré-visualiza mensagem + URL final
//   POST   /links                   -> cria/atualiza
//   DELETE /links/:id
//   POST   /partners                -> cria/atualiza
//   DELETE /partners/:id
//   POST   /templates               -> cria/atualiza
//   DELETE /templates/:id
//   POST   /settings
//
// verify_jwt = false (a autenticação é o app_secret).
// ---------------------------------------------------------------------------

import { serviceClient } from '../_shared/supabase.ts';
import { loadConfig } from '../_shared/config.ts';
import { json, preflight } from '../_shared/cors.ts';
import { stampMessage, whatsappSendUrl, whatsappUrl, type CodeMode } from '../_shared/tracking.ts';

const FN_BASE = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/wa-redirect`;

function shortUrl(domain: string | null | undefined, slug: string): string {
  const d = (domain ?? '').replace(/\/+$/, '');
  return d ? `${d}/${slug}` : `${FN_BASE}/${slug}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();

  const db = serviceClient();
  await loadConfig(db);

  const secret = req.headers.get('x-wa-secret') ?? '';
  if (!secret) return json({ error: 'missing_secret' }, 401);

  const { data: account, error: authErr } = await db.rpc('wa_auth', { p_secret: secret });
  if (authErr) return json({ error: 'auth_error', detail: authErr.message }, 500);
  if (!account) return json({ error: 'unauthorized' }, 401);

  const acc = account as { short_domain?: string; whatsapp_phone?: string };
  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/wa-api/, '').replace(/\/+$/, '') || '/';
  const seg = path.split('/').filter(Boolean);

  const body = ['POST', 'PUT', 'PATCH'].includes(req.method)
    ? ((await req.json().catch(() => ({}))) as Record<string, unknown>)
    : {};

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) {
      const status = /unauthorized/i.test(error.message) ? 401 : 400;
      return json({ error: error.message }, status);
    }
    return json(data);
  };

  // Anexa a URL curta pronta a cada link para a UI não ter que montá-la.
  const withUrls = (payload: unknown): unknown => {
    if (!payload || typeof payload !== 'object') return payload;
    const p = payload as Record<string, unknown>;
    const decorate = (l: Record<string, unknown>) => ({
      ...l,
      short_url: shortUrl(acc.short_domain, String(l.slug ?? '')),
      whatsapp_preview: whatsappUrl(
        String(l.destination_phone ?? acc.whatsapp_phone ?? ''),
        stampMessage(String(l.message ?? ''), String(l.code ?? ''), (l.code_mode as CodeMode) ?? 'invisible'),
      ),
    });
    if (Array.isArray(p.links)) p.links = (p.links as Record<string, unknown>[]).map(decorate);
    if (p.link && typeof p.link === 'object') p.link = decorate(p.link as Record<string, unknown>);
    if (p.slug && p.code) return decorate(p);
    return p;
  };

  try {
    // ---- leitura -----------------------------------------------------------
    if (req.method === 'GET' && seg[0] === 'state') {
      const days = Number(url.searchParams.get('days') ?? 30) || 30;
      const [state, sources] = await Promise.all([
        db.rpc('wa_state', { p_secret: secret, p_days: days }),
        db.rpc('wa_by_source', { p_secret: secret, p_days: days }),
      ]);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({
        ...(withUrls(state.data) as Record<string, unknown>),
        sources: sources.data ?? {},
      });
    }

    if (req.method === 'GET' && seg[0] === 'link' && seg[1]) {
      const { data, error } = await db.rpc('wa_link_detail', {
        p_secret: secret,
        p_id: seg[1],
        p_days: Number(url.searchParams.get('days') ?? 30) || 30,
      });
      if (error) return json({ error: error.message }, 400);
      return json(withUrls(data));
    }

    // A "pasta" do influenciador: links, desempenho de cada um e mês a mês.
    if (req.method === 'GET' && seg[0] === 'partner' && seg[1]) {
      const { data, error } = await db.rpc('wa_partner_detail', {
        p_secret: secret,
        p_id: seg[1],
        p_months: Number(url.searchParams.get('months') ?? 6) || 6,
      });
      if (error) return json({ error: error.message }, 400);
      return json(withUrls(data));
    }

    if (req.method === 'GET' && seg[0] === 'report') {
      const end = url.searchParams.get('end') ?? new Date().toISOString();
      const start =
        url.searchParams.get('start') ?? new Date(Date.now() - 30 * 864e5).toISOString();
      return await call('wa_report', { p_secret: secret, p_start: start, p_end: end });
    }

    if (req.method === 'GET' && seg[0] === 'slug-check') {
      return await call('wa_check_slug', { p_secret: secret, p_slug: url.searchParams.get('slug') ?? '' });
    }

    // ---- pré-visualização (não grava nada) ---------------------------------
    if (req.method === 'POST' && seg[0] === 'compose') {
      const message = String(body.message ?? '');
      const code = String(body.code ?? 'XXXXX');
      const mode = (String(body.code_mode ?? 'invisible') as CodeMode);
      const phone = String(body.destination_phone ?? acc.whatsapp_phone ?? '').replace(/\D/g, '');
      const extras = { src: (body.src as string) ?? null, content: (body.content as string) ?? null };
      const stamped = stampMessage(message, code, mode, extras);
      return json({
        message,
        stamped_message: stamped,
        whatsapp_url: whatsappUrl(phone, stamped),
        // A forma longa é a que o navegador mostra depois do wa.me; serve para
        // quem quer publicar o link do WhatsApp sem passar pelo redirecionador.
        direct_url: whatsappSendUrl(phone, stamped),
        invisible_chars: stamped.length - message.length,
      });
    }

    // ---- escrita -----------------------------------------------------------
    if (req.method === 'POST' && seg[0] === 'links') {
      const { data, error } = await db.rpc('wa_save_link', { p_secret: secret, p_payload: body });
      if (error) return json({ error: error.message }, 400);
      return json(withUrls(data));
    }
    if (req.method === 'DELETE' && seg[0] === 'links' && seg[1]) {
      return await call('wa_delete_link', { p_secret: secret, p_id: seg[1] });
    }

    if (req.method === 'POST' && seg[0] === 'partners') {
      return await call('wa_save_partner', { p_secret: secret, p_payload: body });
    }
    if (req.method === 'DELETE' && seg[0] === 'partners' && seg[1]) {
      return await call('wa_delete_partner', { p_secret: secret, p_id: seg[1] });
    }

    if (req.method === 'POST' && seg[0] === 'templates') {
      return await call('wa_save_template', { p_secret: secret, p_payload: body });
    }
    if (req.method === 'DELETE' && seg[0] === 'templates' && seg[1]) {
      return await call('wa_delete_template', { p_secret: secret, p_id: seg[1] });
    }

    if (req.method === 'POST' && seg[0] === 'settings') {
      return await call('wa_save_settings', { p_secret: secret, p_payload: body });
    }

    return json({ error: 'not_found', path, method: req.method }, 404);
  } catch (e) {
    return json({ error: 'api_error', detail: String(e) }, 500);
  }
});
