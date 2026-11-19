/**
 * Accessible progressive forms. Native HTML first (action/method), enhanced with
 * inline validation, JSON submit to the Vercel function, and a one-click email
 * fallback that preserves everything the visitor typed if the endpoint is down.
 */
const MAX_ATTACH = 3.5 * 1024 * 1024;

const messages: Record<string, string> = {
  valueMissing: 'This field is required.',
  typeMismatch: 'Please check the format.',
  patternMismatch: 'Please enter a valid phone number.',
  tooShort: 'Please tell us a little more.',
  tooLong: 'Please keep this shorter.',
};

function fieldError(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const v = el.validity;
  if (v.valid) return '';
  if (v.valueMissing) {
    if (el instanceof HTMLInputElement && el.type === 'radio') return 'Please choose one.';
    if (el instanceof HTMLInputElement && el.type === 'file') return 'Please attach your CV / resume.';
    return messages.valueMissing;
  }
  if (v.typeMismatch) return (el as HTMLInputElement).type === 'email' ? 'Please enter a valid email address.' : 'Please enter a full link, starting with https://';
  if (v.patternMismatch) return messages.patternMismatch;
  if (v.tooShort) return messages.tooShort;
  if (v.tooLong) return messages.tooLong;
  return 'Please check this field.';
}

function setError(el: HTMLElement, msg: string) {
  const field = el.closest('.field') as HTMLElement | null;
  if (!field) return;
  const id = `${(el as HTMLInputElement).name}-err`;
  let err = field.querySelector<HTMLElement>('.err');
  const targets = el.matches('[type="radio"]') ? field.querySelectorAll('input') : [el];
  if (msg) {
    if (!err) {
      err = document.createElement('span');
      err.className = 'err';
      err.id = id;
      field.appendChild(err);
    }
    err.textContent = msg;
    targets.forEach((t) => {
      t.setAttribute('aria-invalid', 'true');
      t.setAttribute('aria-describedby', id);
    });
  } else {
    err?.remove();
    targets.forEach((t) => {
      t.removeAttribute('aria-invalid');
      t.removeAttribute('aria-describedby');
    });
  }
}

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function initForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    const started = Date.now();
    const status = form.querySelector<HTMLElement>('.form-status')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const label = submit.querySelector('span')!;
    const idle = label.textContent;
    let busy = false;
    const controls = () => Array.from(form.elements).filter((e): e is HTMLInputElement => 'validity' in e && !(e as HTMLElement).closest('.hp'));

    form.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.getAttribute('aria-invalid') === 'true') setError(t, fieldError(t));
    });
    form.addEventListener('focusout', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.value && 'validity' in t) setError(t, fieldError(t));
    });

    const showStatus = (html: string, tone: 'ok' | 'err' | 'info') => {
      status.hidden = false;
      status.dataset.tone = tone;
      status.innerHTML = html;
    };

    const mailtoFallback = (data: Record<string, string>) => {
      const to = form.dataset.mailto!;
      const subject = form.dataset.form === 'apply' ? `Application — ${data.position || 'HekayaHaus'} — ${data.fullName || ''}` : `Project enquiry — ${data.firstName || ''} ${data.lastName || ''}`;
      const body = Object.entries(data)
        .filter(([k, v]) => v && k !== 'website_url')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: ${v}`)
        .join('\n');
      const extra = form.dataset.form === 'apply' ? '\n\n(Please attach your CV and portfolio to this email.)' : '';
      return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + extra)}`;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      let firstBad: HTMLElement | null = null;
      const seenRadio = new Set<string>();
      controls().forEach((c) => {
        if (c.type === 'radio') {
          if (seenRadio.has(c.name)) return;
          seenRadio.add(c.name);
        }
        const msg = fieldError(c);
        setError(c, msg);
        if (msg && !firstBad) firstBad = c;
      });
      const files = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]')).flatMap((i) => Array.from(i.files ?? []));
      const total = files.reduce((n, f) => n + f.size, 0);
      if (total > MAX_ATTACH) {
        const work = form.querySelector<HTMLInputElement>('input[name="work"]') ?? form.querySelector<HTMLInputElement>('input[type="file"]')!;
        setError(work, 'Attachments must total under 3.5 MB. Add a portfolio link above for larger work.');
        firstBad ??= work;
      }
      if (firstBad) {
        (firstBad as HTMLElement).focus();
        showStatus('Please check the highlighted fields.', 'err');
        return;
      }

      busy = true;
      submit.disabled = true;
      label.textContent = 'Sending…';
      status.hidden = true;

      const fd = new FormData(form);
      const data: Record<string, string> = {};
      fd.forEach((v, k) => {
        if (typeof v === 'string') data[k] = v.trim();
      });
      try {
        const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name, content: await toBase64(f) })));
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, attachments, elapsed: Date.now() - started }),
        });
        if (res.ok) {
          const tpl = form.parentElement!.querySelector<HTMLTemplateElement>('template[data-success]');
          if (tpl) {
            const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
            form.replaceWith(node);
            node.focus();
            node.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          return;
        }
        if (res.status === 400) {
          const j = await res.json().catch(() => ({}));
          Object.entries(j.errors ?? {}).forEach(([k, msg]) => {
            const el = form.elements.namedItem(k) as HTMLElement | null;
            if (el && 'validity' in el) setError(el, String(msg));
          });
          showStatus('Please check the highlighted fields.', 'err');
          return;
        }
        throw new Error(String(res.status));
      } catch {
        showStatus(
          `We couldn’t send this from the website right now. Your answers are still here — <a class="accent" href="${mailtoFallback(data)}"><strong>send them by email in one click</strong></a> and they’ll reach the team directly.`,
          'err',
        );
      } finally {
        busy = false;
        submit.disabled = false;
        label.textContent = idle;
      }
    });
  });
}
