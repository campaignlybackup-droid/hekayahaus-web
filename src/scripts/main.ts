import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = window.matchMedia('(pointer: fine) and (hover: hover)');
export const motionOK = () => !reduceMQ.matches;

/* ---------------- smooth scroll (single rAF driver: GSAP ticker) ---------------- */
let lenis: Lenis | null = null;
function startLenis() {
  if (lenis || !motionOK()) return;
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(lenisRaf);
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;
}
function lenisRaf(t: number) {
  lenis?.raf(t * 1000);
}
function stopLenis() {
  if (!lenis) return;
  gsap.ticker.remove(lenisRaf);
  lenis.destroy();
  lenis = null;
  (window as any).__lenis = null;
}
startLenis();
reduceMQ.addEventListener('change', () => {
  if (reduceMQ.matches) {
    stopLenis();
    root.classList.remove('motion');
    document.querySelectorAll('[data-reveal],[data-split]').forEach((el) => el.classList.add('in'));
  } else {
    root.classList.add('motion');
    startLenis();
  }
});

export const scrollLock = (lock: boolean) => {
  if (lenis) lock ? lenis.stop() : lenis.start();
  document.body.style.overflow = lock ? 'hidden' : '';
};

/* ---------------- reveals ---------------- */
const revealEls = document.querySelectorAll<HTMLElement>('[data-reveal],[data-split]');
if (!motionOK() || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealEls.forEach((el) => {
    if (el.closest('[data-reveal-manual]')) return;
    io.observe(el);
  });
}

/* ---------------- parallax media ---------------- */
if (motionOK()) {
  document.querySelectorAll<HTMLElement>('.media--parallax img').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

/* ---------------- nav: scrolled state + hide on scroll down ---------------- */
const nav = document.getElementById('nav');
let lastY = window.scrollY;
const onScroll = () => {
  const y = window.scrollY;
  nav?.classList.toggle('is-scrolled', y > 24);
  if (!document.body.classList.contains('menu-open')) {
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 400) nav?.classList.add('is-hidden');
    else if (goingUp || y < 200) nav?.classList.remove('is-hidden');
  }
  lastY = y;
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* dropdown */
document.querySelectorAll<HTMLElement>('[data-dropdown]').forEach((dd) => {
  const btn = dd.querySelector('button')!;
  let closeTimer = 0;
  const set = (open: boolean) => {
    dd.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!dd.classList.contains('is-open')));
  if (fineMQ.matches) {
    dd.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      set(true);
    });
    dd.addEventListener('mouseleave', () => {
      closeTimer = window.setTimeout(() => set(false), 160);
    });
  }
  dd.addEventListener('focusout', (e) => {
    if (!dd.contains(e.relatedTarget as Node)) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dd.classList.contains('is-open')) {
      set(false);
      btn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target as Node)) set(false);
  });
});

/* mobile menu */
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
const menu = document.getElementById('mobile-menu');
const setMenu = (open: boolean) => {
  document.body.classList.toggle('menu-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  menuBtn?.querySelector('.menu-label')!.replaceChildren(open ? 'Close' : 'Menu');
  scrollLock(open);
  if (open) {
    nav?.classList.remove('is-hidden');
    menu?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  }
};
menuBtn?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
    setMenu(false);
    menuBtn?.focus();
  }
});
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
if (menu) menu.inert = true;
new MutationObserver(() => {
  if (menu) menu.inert = !document.body.classList.contains('menu-open');
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* ---------------- reel modal ---------------- */
const modal = document.getElementById('reel-modal');
const frame = modal?.querySelector<HTMLElement>('[data-reel-frame]');
const reelTitle = modal?.querySelector<HTMLElement>('#reel-title');
let lastFocus: HTMLElement | null = null;
const closeReel = () => {
  if (!modal) return;
  modal.classList.remove('is-open');
  scrollLock(false);
  setTimeout(() => {
    modal.hidden = true;
    frame?.replaceChildren();
  }, 320);
  lastFocus?.focus();
};
document.addEventListener('click', (e) => {
  const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-reel]');
  if (!trigger || !modal || !frame) return;
  e.preventDefault();
  lastFocus = trigger;
  const iframe = document.createElement('iframe');
  iframe.src = trigger.dataset.reel!;
  iframe.title = trigger.dataset.reelTitle || 'HekayaHaus showreel';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  frame.replaceChildren(iframe);
  if (reelTitle) reelTitle.textContent = trigger.dataset.reelTitle || 'Showreel';
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-open'));
  scrollLock(true);
  modal.querySelector<HTMLElement>('[data-reel-close]')?.focus();
});
modal?.addEventListener('click', (e) => {
  if (e.target === modal || (e.target as HTMLElement).closest('[data-reel-close]')) closeReel();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('is-open')) closeReel();
  if (e.key === 'Tab' && modal?.classList.contains('is-open')) {
    const focusables = modal.querySelectorAll<HTMLElement>('button, iframe');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

/* ---------------- card spotlight ---------------- */
document.querySelectorAll<HTMLElement>('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ---------------- counters ---------------- */
document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
  const target = Number(el.dataset.count);
  if (!motionOK()) return;
  const obj = { v: 0 };
  el.textContent = '0';
  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter: () =>
      gsap.to(obj, {
        v: target,
        duration: 1.8,
        ease: 'expo.out',
        onUpdate: () => (el.textContent = String(Math.round(obj.v))),
      }),
  });
});

/* ---------------- cursor + magnetic (fine pointers only) ---------------- */
function initPointer() {
  if (!fineMQ.matches || !motionOK()) return;
  root.classList.add('has-cursor');
  const cursor = document.querySelector<HTMLElement>('.cursor')!;
  const dot = cursor.querySelector<HTMLElement>('.cursor-dot')!;
  const ring = cursor.querySelector<HTMLElement>('.cursor-ring')!;
  const label = ring.querySelector('span')!;
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };
  const dotX = gsap.quickSetter(dot, 'x', 'px');
  const dotY = gsap.quickSetter(dot, 'y', 'px');
  const ringX = gsap.quickSetter(ring, 'x', 'px');
  const ringY = gsap.quickSetter(ring, 'y', 'px');
  window.addEventListener(
    'pointermove',
    (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      cursor.classList.add('is-on');
      dotX(pos.x);
      dotY(pos.y);
    },
    { passive: true },
  );
  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    ringX(ringPos.x);
    ringY(ringPos.y);
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target as HTMLElement;
    const labelled = t.closest<HTMLElement>('[data-cursor]');
    const link = t.closest('a, button, summary, label, select, [role="button"]');
    cursor.classList.toggle('is-label', !!labelled);
    cursor.classList.toggle('is-link', !labelled && !!link);
    label.textContent = labelled?.dataset.cursor ?? '';
  });
  document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-link', 'is-label', 'is-on'));

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}
initPointer();

/* ---------------- 3D tilt + light glare ---------------- */
function initTilt() {
  if (!fineMQ.matches || !motionOK()) return;
  const sel = '.project-tile .media, .reel-card, .rail-item .media, .film-card .media, .pillar-img, .feature-article .media, .haus-img, .contact-line, .perks .card, .grid-3 .card, .grid-2 .card, .together > div, .fi-item';
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    el.classList.add('tilt');
    const glare = document.createElement('span');
    glare.className = 'glare';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
    let armed = false;
    const arm = () => {
      if (armed) return true;
      if (el.hasAttribute('data-reveal') && root.classList.contains('motion') && !el.classList.contains('in')) return false;
      armed = true;
      el.classList.add('tilting');
      gsap.set(el, { transformPerspective: 900, transformOrigin: '50% 50%' });
      return true;
    };
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const max = el.matches('.card, .contact-line, .together > div, .fi-item') ? 5 : 7;
    el.addEventListener('pointermove', (e) => {
      if (!arm()) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * max * 2);
      rx(-(y - 0.5) * max * 2);
      el.style.setProperty('--gx', `${x * 100}%`);
      el.style.setProperty('--gy', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}
initTilt();

/* ---------------- footer: spotlight wordmark ---------------- */
const footerWord = document.querySelector<HTMLElement>('.footer-word');
const footer = document.querySelector<HTMLElement>('.footer');
if (footerWord && footer && fineMQ.matches) {
  footer.addEventListener('pointermove', (e) => {
    const r = footerWord.getBoundingClientRect();
    footerWord.style.setProperty('--fx', `${e.clientX - r.left}px`);
    footerWord.style.setProperty('--fy', `${e.clientY - r.top}px`);
    footerWord.classList.add('is-lit');
  });
  footer.addEventListener('pointerleave', () => footerWord.classList.remove('is-lit'));
}

/* ---------------- 3D logo orbit ---------------- */
document.querySelectorAll<HTMLElement>('[data-orbit]').forEach((ring) => {
  if (!motionOK()) return;
  const items = Array.from(ring.querySelectorAll<HTMLElement>('li'));
  ring.classList.add('is-3d');
  let angle = 0;
  let boost = 0;
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(ring);
  ScrollTrigger.create({ trigger: ring, start: 'top bottom', end: 'bottom top', onUpdate: (st) => (boost = Math.min(3, Math.abs(st.getVelocity()) / 600)) });
  let paused = false;
  ring.addEventListener('pointerenter', () => (paused = true));
  ring.addEventListener('pointerleave', () => (paused = false));
  gsap.ticker.add((_t, dt) => {
    if (!visible) return;
    boost *= 0.95;
    if (!paused) angle += (dt / 1000) * (0.16 + boost * 0.5);
    const R = ring.clientWidth * 0.42;
    items.forEach((li, i) => {
      const th = angle + (i / items.length) * Math.PI * 2;
      const z = Math.cos(th);
      const x = Math.sin(th) * R;
      const depth = (z + 1) / 2; // 0 back → 1 front
      li.style.transform = `translate3d(${x}px, ${-(1 - depth) * 46}px, ${z * R * 0.6}px) scale(${0.6 + depth * 0.5})`;
      li.style.opacity = String(0.12 + depth * 0.88);
      li.style.zIndex = String(Math.round(depth * 100));
    });
  });
});

/* inner-page hero: projector light shader (falls back to CSS glow) */
const lightHost = document.querySelector<HTMLElement>('.page-hero[data-glow]');
if (lightHost && motionOK() && !(navigator as any).connection?.saveData) {
  const go = () => import('./lightfield').then((m) => m.initLightField(lightHost, gsap.ticker));
  'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 300);
}

/* hero glow follows pointer on inner pages */
const glow = document.querySelector<HTMLElement>('[data-glow]');
if (glow && fineMQ.matches && motionOK()) {
  glow.addEventListener('pointermove', (e) => {
    const r = glow.getBoundingClientRect();
    glow.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    glow.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
}

/* marquee: pause when offscreen (saves work) + pause toggle */
document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((m) => {
  const io = new IntersectionObserver(([e]) => m.classList.toggle('is-paused', !e.isIntersecting));
  io.observe(m);
});

/* ---------------- page modules ---------------- */
const modules = new Set(Array.from(document.querySelectorAll<HTMLElement>('[data-module]')).map((el) => el.dataset.module));
if (modules.has('home')) import('./home').then((m) => m.initHome({ gsap, ScrollTrigger, motionOK }));
if (modules.has('form')) import('./forms').then((m) => m.initForms());
if (modules.has('haus')) import('./hausboot').then((m) => m.initHaus());
if (modules.has('filter')) import('./filter').then((m) => m.initFilter());

window.addEventListener('load', () => ScrollTrigger.refresh());
