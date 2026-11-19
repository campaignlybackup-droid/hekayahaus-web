// Shared helpers for the contact + application functions.
// Email is sent through Resend's REST API (no SDK). Configure in Vercel:
//   RESEND_API_KEY  — required to send
//   MAIL_FROM       — verified sender, e.g. "HekayaHaus Website <website@hekayahaus.com>"
//   CONTACT_TO      — defaults to info@hekayahaus.com
//   APPLY_TO        — defaults to hr@hekayahaus.com
// Without RESEND_API_KEY the endpoints answer 503 and the site offers a one-click email fallback.

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const isEmail = (s = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim());
export const isPhone = (s = '') => /^\+?[0-9\s()-]{7,20}$/.test(String(s).trim());

export async function readBody(request, limit = 6_000_000) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > limit) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Basic bot screening: honeypot + minimum time on page. */
export const looksLikeBot = (b) => Boolean(b.website_url) || Number(b.elapsed || 0) < 2500;

export function table(rows) {
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`;
}

export async function send({ to, subject, html, replyTo, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 503 };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'HekayaHaus Website <website@hekayahaus.com>',
      to: [to],
      subject,
      html,
      reply_to: replyTo,
      attachments,
    }),
  });
  return { ok: res.ok, status: res.ok ? 200 : 502 };
}
