// Smart Tags — receptor de webhook do GHL.
// Caminho rápido: quando uma tag é aplicada a um contato, ela é registrada como
// opção do custom field de oportunidade e (opcionalmente) escrita nas
// oportunidades daquele contato.
//
// Auth: header x-smarttags-secret (ou ?secret=) com o webhook_secret da conta.
import {
  Account,
  accountByLocation,
  applyValueToOpportunity,
  db,
  ensureField,
  ghl,
  json,
  mapLimit,
  normalizeTagNames,
  rpc,
  searchOpportunities,
  secretMatches,
  syncFieldOptions,
  tagKey,
} from './core.ts';

/** O payload varia conforme a origem (workflow, app marketplace, custom). */
function pick(payload: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = key.split('.').reduce((acc: any, k) => (acc == null ? acc : acc[k]), payload);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractTags(payload: any): unknown {
  if (Array.isArray(payload?.tags)) return payload.tags;
  if (typeof payload?.tags === 'string') return payload.tags;
  if (Array.isArray(payload?.contact?.tags)) return payload.contact.tags;
  if (typeof payload?.contact?.tags === 'string') return payload.contact.tags;
  const single = pick(payload, ['tag', 'tag_name', 'tagName', 'new_tag']);
  return single ? [single] : [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') return json(200, { ok: true, service: 'smart-tags-webhook' });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = new URL(req.url);
  const secret = req.headers.get('x-smarttags-secret') ?? url.searchParams.get('secret') ?? '';

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(200, { ok: false, error: 'invalid_json' });
  }

  const locationId =
    pick(payload, ['location_id', 'locationId', 'location.id']) ?? url.searchParams.get('location_id');
  if (!locationId) return json(200, { ok: false, error: 'location_id_ausente' });

  const client = db();
  const account = await accountByLocation(client, locationId);
  if (!account || !secretMatches(account.webhook_secret, secret)) {
    return json(401, { error: 'unauthorized' });
  }
  if (!account.active) return json(200, { ok: false, error: 'account_inactive' });

  const eventType = pick(payload, ['type', 'event', 'event_type', 'eventType']) ?? 'webhook';
  const contactId = pick(payload, [
    'contact_id',
    'contactId',
    'contact.id',
    // No webhook do app o id raiz é o do próprio recurso do evento.
    ...(String(eventType).startsWith('Contact') ? ['id'] : []),
  ]);

  const eventId = await rpc<string>(client, 'smarttags_log_event', {
    p_account_id: account.id,
    p_location_id: locationId,
    p_event_type: eventType,
    p_contact_id: contactId,
    p_payload: payload,
  });

  try {
    const result = await handle(client, account, payload, contactId);
    await rpc(client, 'smarttags_finish_event', {
      p_event_id: eventId,
      p_status: result.tags.length ? 'ok' : 'ignored',
      p_tags_new: result.tagsNew,
      p_opps: result.opportunitiesUpdated,
      p_error: null,
    });
    return json(200, { ok: true, ...result });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    await rpc(client, 'smarttags_finish_event', {
      p_event_id: eventId,
      p_status: 'error',
      p_tags_new: [],
      p_opps: 0,
      p_error: message,
    });
    return json(200, { ok: false, error: message });
  }
});

async function handle(
  client: ReturnType<typeof db>,
  account: Account,
  payload: any,
  contactId: string | null,
) {
  let tags = normalizeTagNames(extractTags(payload), account.ignore_prefixes);

  // As oportunidades do contato já trazem as tags vivas do contato — usar essa
  // lista corrige remoções que o payload do webhook não reflete.
  let opportunities: Awaited<ReturnType<typeof searchOpportunities>>['opportunities'] = [];
  if (contactId) {
    const page = await searchOpportunities(account, { contactId, limit: 100 });
    opportunities = page.opportunities;

    const live = opportunities.find((o) => Array.isArray(o.contact?.tags))?.contact?.tags;
    if (live) tags = normalizeTagNames(live, account.ignore_prefixes);
  }

  // Sem tag e sem contato não há o que fazer.
  if (tags.length === 0 && opportunities.length === 0) {
    return { tags: [], tagsNew: [], opportunitiesUpdated: 0, optionsAdded: [] };
  }

  // Se o contato não tem oportunidade e não veio tag no payload, buscar o
  // contato garante que a tag ainda seja catalogada.
  if (tags.length === 0 && contactId) {
    try {
      const fetched = await ghl<any>(account.pit_token, `/contacts/${contactId}`);
      tags = normalizeTagNames(fetched?.contact?.tags ?? fetched?.tags, account.ignore_prefixes);
    } catch {
      // segue com o que temos
    }
  }

  const recorded = await rpc<{ new: string[] }>(client, 'smarttags_record_tags', {
    p_account_id: account.id,
    p_tags: tags.map((name) => ({ name, id: null })),
    p_source: 'webhook',
    p_mark_missing: false,
  });

  const field = await ensureField(client, account, tags);

  // As opções precisam existir antes de virar valor, senão o pipeline mostra
  // valor órfão que não aparece no filtro.
  let optionsAdded: string[] = [];
  if (account.sync_options && tags.length) {
    const sync = await syncFieldOptions(account, field, tags);
    optionsAdded = sync.added;
    if (sync.added.length) {
      await rpc(client, 'smarttags_mark_options', {
        p_account_id: account.id,
        p_names: sync.options,
      });
    }
  }

  let opportunitiesUpdated = 0;
  if (account.sync_values && opportunities.length) {
    const writes = await mapLimit(opportunities, 4, async (opp) => {
      const own = Array.isArray(opp.contact?.tags)
        ? normalizeTagNames(opp.contact!.tags, account.ignore_prefixes)
        : tags;
      const allowed = own.filter((t) =>
        (field.picklistOptions ?? []).some((o) => tagKey(o) === tagKey(t))
      );
      return await applyValueToOpportunity(account, field, opp, allowed);
    });
    opportunitiesUpdated = writes.filter(Boolean).length;
  }

  return {
    tags,
    tagsNew: recorded?.new ?? [],
    optionsAdded,
    opportunitiesUpdated,
  };
}
