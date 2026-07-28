import type { BrandConfig, QuoteProfile } from "./types";

/**
 * The e-mail version of the proposal dispatch. WhatsApp/SMS send the plain text
 * as-is (that's her real message, kept word for word — lib/cotacao/message.ts);
 * e-mail wraps that same text in a branded, single-column HTML with a clear CTA
 * to the proposal, because an e-mail with a bare link reads as spam.
 *
 * Self-contained inline styles only — e-mail clients strip <style> and external
 * CSS. No remote images (the brand shows as a wordmark, not a logo request).
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildClientEmail(args: {
  profile: QuoteProfile;
  /** The plain-text message (already includes the intro + the caveat line). */
  message: string;
  proposalUrl: string;
  brand: BrandConfig;
  disclaimer: string;
}): { subject: string; html: string } {
  const { profile, message, proposalUrl, brand, disclaimer } = args;

  const first = (profile.contactName || "").trim().split(/\s+/)[0] || "";
  const subject = `Sua cotação de seguro saúde ${profile.year}${brand.name ? ` — ${brand.name}` : ""}`;

  // The message text may already end with the URL (WhatsApp format). Strip a
  // trailing bare URL so the e-mail doesn't show the link twice — once as text
  // and once as the button.
  const bodyText = message.replace(proposalUrl, "").replace(/\n{3,}$/, "\n").trimEnd();
  const paragraphs = esc(bodyText).replace(/\n/g, "<br/>");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f3f4f6;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);">
    <tr><td style="background:${esc(brand.primary)};padding:20px 28px;">
      <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.2px;">${esc(brand.name)}</div>
      <div style="color:rgba(255,255,255,.72);font-size:12px;margin-top:2px;">${esc(brand.tagline)}</div>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;">
      ${first ? `<p style="margin:0 0 14px;font-size:15px;">Olá, ${esc(first)} 👋</p>` : ""}
      <div style="font-size:14px;line-height:1.6;color:#374151;">${paragraphs}</div>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;">
      <a href="${esc(proposalUrl)}" style="display:inline-block;background:${esc(
        brand.primary,
      )};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:10px;">Ver minha cotação</a>
      <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">Ou copie este link: <br/><span style="color:#374151;word-break:break-all;">${esc(
        proposalUrl,
      )}</span></p>
    </td></tr>
    <tr><td style="padding:0 28px 26px;">
      <p style="margin:0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.5;color:#9ca3af;">${esc(
        disclaimer,
      )}</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}
