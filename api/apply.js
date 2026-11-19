import { json, readBody, looksLikeBot, isEmail, isPhone, table, send } from './_lib/mail.js';

const MAX = 3.5 * 1024 * 1024;
const OK_EXT = /\.(pdf|docx?|jpe?g|png|webp|zip)$/i;

export async function POST(request) {
  const b = await readBody(request, 5_500_000);
  if (!b) return json(400, { errors: { files: 'Attachments must total under 3.5 MB.' } });
  if (looksLikeBot(b)) return json(200, { ok: true });

  const errors = {};
  if (!b.fullName?.trim()) errors.fullName = 'Please add your full name.';
  if (!isEmail(b.email)) errors.email = 'Please enter a valid email address.';
  if (!isPhone(b.phone)) errors.phone = 'Please enter a valid phone number.';
  if (!b.location?.trim()) errors.location = 'Please add your current location.';
  if (!b.position) errors.position = 'Please choose a position or department.';
  if (!b.employmentType) errors.employmentType = 'Please choose one.';
  if (!b.why || b.why.trim().length < 10) errors.why = 'Please tell us a little more.';

  const attachments = Array.isArray(b.attachments) ? b.attachments.slice(0, 2) : [];
  const bytes = attachments.reduce((n, a) => n + Math.floor(((a.content || '').length * 3) / 4), 0);
  if (!attachments.length) errors.cv = 'Please attach your CV / resume.';
  if (bytes > MAX) errors.work = 'Attachments must total under 3.5 MB.';
  if (attachments.some((a) => !OK_EXT.test(a.filename || ''))) errors.work = 'Please use PDF, Word, image or ZIP files.';
  if (Object.keys(errors).length) return json(400, { errors });

  const html = `<h2 style="font-family:Arial,sans-serif">New application — ${b.position}</h2>${table([
    ['Name', b.fullName],
    ['Email', b.email],
    ['Phone / WhatsApp', b.phone],
    ['Location', b.location],
    ['LinkedIn', b.linkedin],
    ['Portfolio', b.portfolioUrl],
    ['Position', b.position],
    ['Employment type', b.employmentType],
    ['Experience (years)', b.experience],
    ['Availability', b.availability],
    ['Compensation', b.compensation],
    ['Why HekayaHaus?', b.why],
    ['Why a good fit?', b.fit],
    ['Proud of', b.proud],
  ])}`;
  const r = await send({
    to: process.env.APPLY_TO || 'hr@hekayahaus.com',
    subject: `Application — ${b.position} — ${b.fullName}`,
    html,
    replyTo: b.email,
    attachments: attachments.map((a) => ({ filename: String(a.filename).slice(0, 120), content: a.content })),
  });
  return r.ok ? json(200, { ok: true }) : json(r.status, { error: 'unavailable' });
}
