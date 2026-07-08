// Spark QR — admin API (panel backend).
//
// CRUD over qr.qr_codes + analytics. Mirrors the soneko-api pattern:
// service-role client, all logic behind public spark_qr_* RPCs that take the
// app secret as their first argument.
//
//   GET    /qrs                 -> list (with scan counts)
//   GET    /qrs/:id             -> single
//   POST   /qrs                 -> create   { slug, target_url, name }
//   PATCH  /qrs/:id             -> update   { slug?, target_url?, name?, is_active? }
//   DELETE /qrs/:id             -> delete
//   GET    /check-slug?slug=&exclude=   -> { available, reason }
//   GET    /qrs/:id/analytics?days=30   -> analytics json
//
// Auth: every request MUST carry the admin secret via `x-spark-secret` header
// (or ?secret=). No secret → 401; wrong secret → the RPC's assert_secret raises
// invalid_secret → 401. There is no anonymous/keyless access.
//
// verify_jwt MUST be false (custom secret auth).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-spark-secret, x-spark-location, apikey',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Map Postgres errors to HTTP status + a stable error code for the UI.
function fail(error: { message?: string; code?: string }) {
  const msg = error?.message ?? 'error';
  if (error?.code === '42501' || /invalid_secret/.test(msg)) return json(401, { error: 'invalid_secret' });
  if (/not_found/.test(msg)) return json(404, { error: 'not_found' });
  if (/duplicate key|unique/.test(msg)) return json(409, { error: 'slug_taken' });
  if (/invalid_slug|reserved_slug|invalid_target_url|missing_target_url|invalid_format/.test(msg)) {
    return json(422, { error: msg.split(/\s/)[0] });
  }
  return json(400, { error: msg });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/spark-qr-admin/, '') || '/';

  if (path === '/warmup') return json(200, { ok: true, ts: Date.now() });

  const secret =
    req.headers.get('x-spark-secret') ?? url.searchParams.get('secret') ?? '';
  if (!secret) return json(401, { error: 'missing_secret' });

  // Location scope: the GHL menu link carries {{location.id}} so each GHL
  // account sees only its own QR codes. Empty string = the main/global panel.
  const location =
    req.headers.get('x-spark-location') ?? url.searchParams.get('location') ?? '';

  const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn, args);

  try {
    // GET /overview?days=30  — dashboard aggregate
    if (req.method === 'GET' && path === '/overview') {
      const days = parseInt(url.searchParams.get('days') ?? '30', 10);
      const { data, error } = await rpc('spark_qr_overview', {
        p_secret: secret, p_location_id: location, p_days: isNaN(days) ? 30 : days,
      });
      if (error) return fail(error);
      return json(200, data);
    }

    // GET /check-slug?slug=&exclude=   (slug is global, no location scope)
    if (req.method === 'GET' && path === '/check-slug') {
      const slug = url.searchParams.get('slug') ?? '';
      const exclude = url.searchParams.get('exclude');
      const { data, error } = await rpc('spark_qr_check_slug', {
        p_secret: secret, p_slug: slug, p_exclude_id: exclude || null,
      });
      if (error) return fail(error);
      return json(200, data);
    }

    // GET /qrs
    if (req.method === 'GET' && path === '/qrs') {
      const { data, error } = await rpc('spark_qr_list', { p_secret: secret, p_location_id: location });
      if (error) return fail(error);
      return json(200, data);
    }

    // GET /qrs/:id/analytics
    const analyticsMatch = path.match(/^\/qrs\/([0-9a-f-]{36})\/analytics$/i);
    if (req.method === 'GET' && analyticsMatch) {
      const days = parseInt(url.searchParams.get('days') ?? '30', 10);
      const { data, error } = await rpc('spark_qr_analytics', {
        p_secret: secret, p_id: analyticsMatch[1], p_location_id: location, p_days: isNaN(days) ? 30 : days,
      });
      if (error) return fail(error);
      return json(200, data);
    }

    // GET /qrs/:id
    const idMatch = path.match(/^\/qrs\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && idMatch) {
      const { data, error } = await rpc('spark_qr_get', { p_secret: secret, p_id: idMatch[1], p_location_id: location });
      if (error) return fail(error);
      return json(200, data);
    }

    // POST /qrs
    if (req.method === 'POST' && path === '/qrs') {
      const body = await req.json().catch(() => ({}));
      const { data, error } = await rpc('spark_qr_create', {
        p_secret: secret,
        p_location_id: location,
        p_slug: body.slug ?? '',
        p_target_url: body.target_url ?? '',
        p_name: body.name ?? '',
      });
      if (error) return fail(error);
      return json(201, data);
    }

    // PATCH /qrs/:id
    if (req.method === 'PATCH' && idMatch) {
      const body = await req.json().catch(() => ({}));
      const { data, error } = await rpc('spark_qr_update', {
        p_secret: secret,
        p_id: idMatch[1],
        p_location_id: location,
        p_slug: body.slug ?? null,
        p_target_url: body.target_url ?? null,
        p_name: body.name ?? null,
        p_is_active: typeof body.is_active === 'boolean' ? body.is_active : null,
      });
      if (error) return fail(error);
      return json(200, data);
    }

    // DELETE /qrs/:id
    if (req.method === 'DELETE' && idMatch) {
      const { data, error } = await rpc('spark_qr_delete', { p_secret: secret, p_id: idMatch[1], p_location_id: location });
      if (error) return fail(error);
      return json(200, data);
    }

    return json(404, { error: 'not_found', path });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
