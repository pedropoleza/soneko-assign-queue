// Iframe-only guard. The panel is meant to run ONLY embedded inside the
// GoHighLevel app (Custom Menu Link). Accessing the URL standalone is blocked.
//
// Primary check (domain-independent, reliable): are we inside an iframe at all?
// Accessing window.top across a cross-origin boundary throws — which itself
// means we ARE embedded in a different-origin parent (i.e. GHL), so we allow.

export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent blocked the access → we are embedded. Allow.
    return true;
  }
}

// Best-effort parent-origin allow-list (defense in depth). Cross-origin embeds
// usually hide the ancestor, so this only ever *blocks* when we can positively
// read the ancestor AND it is clearly not allowed — it never false-blocks.
const ALLOWED = (import.meta.env.VITE_ALLOWED_ANCESTORS as string | undefined)
  ?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  ?? ['gohighlevel.com', 'leadconnectorhq.com', 'msgsndr.com', 'sparkleads.pro'];

export function ancestorAllowed(): boolean {
  let host = '';
  try {
    const ao = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (ao && ao.length) host = new URL(ao[0]).hostname.toLowerCase();
    else if (document.referrer) host = new URL(document.referrer).hostname.toLowerCase();
  } catch { /* ignore */ }

  if (!host) return true; // couldn't determine → don't false-block
  return ALLOWED.some((d) => host === d || host.endsWith(`.${d}`));
}
