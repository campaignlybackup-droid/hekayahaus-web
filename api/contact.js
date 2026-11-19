import { json, readBody, looksLikeBot, isEmail, isPhone, table, send } from './_lib/mail.js';

export async function POST(request) {
  const b = await readBody(request, 100_000);
  if (!b) return json(400, { errors: { message: 'Invalid request.' } });
  if (looksLikeBot(b)) return json(200, { ok: true });

  const errors = {};
  if (!b.firstName?.trim()) errors.firstName = 'Please add your first name.';
  if (!b.lastName?.trim()) errors.lastName = 'Please add your last name.';
  if (!isEmail(b.email)) errors.email = 'Please enter a valid email address.';
  if (!isPhone(b.phone)) errors.phone = 'Please enter a valid phone number.';
  if (!b.message || b.message.trim().length < 10) errors.message = 'Please tell us a little more.';
  if (b.message && b.message.length > 4000) errors.message = 'Please keep this under 4,000 characters.';
  if (Object.keys(errors).length) return json(400, { errors });

  const name = `${b.firstName} ${b.lastName}`.trim();
  const html = `<h2 style="font-family:Arial,sans-serif">New project enquiry</h2>${table([
    ['Name', name],
    ['Email', b.email],
    ['Phone / WhatsApp', b.phone],
    ['Company', b.company],
    ['Website / socials', b.website],
    ['Discipline', b.discipline],
    ['Business offers', b.offer],
    ['Message', b.message],
  ])}`;
  const r = await send({ to: process.env.CONTACT_TO || 'info@hekayahaus.com', subject: `Project enquiry — ${name}`, html, replyTo: b.email });
  return r.ok ? json(200, { ok: true }) : json(r.status, { error: 'unavailable' });
}
