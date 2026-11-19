import type { gsap as GSAP } from 'gsap';
import type { ScrollTrigger as ST } from 'gsap/ScrollTrigger';

type Ctx = { gsap: typeof GSAP; ScrollTrigger: typeof ST; motionOK: () => boolean };

export async function initHome({ gsap, ScrollTrigger, motionOK }: Ctx) {
  const root = document.documentElement;
  (window as any).__introStarted = true;
  const hero = document.querySelector<HTMLElement>('.hero')!;
  const canvas = hero.querySelector<HTMLCanvasElement>('.hero-canvas')!;
  const word = hero.querySelector<HTMLElement>('.hero-word')!;
  const group = hero.querySelector<HTMLElement>('.hero-group')!;
  const chars = hero.querySelectorAll<HTMLElement>('.hero-word .ch');
  const tagLines = hero.querySelectorAll<HTMLElement>('.hero-tag .tl > span');
  const late = hero.querySelectorAll<HTMLElement>('[data-hero-late]');
  const motion = motionOK();

  /* ---------- 3D dust (progressive enhancement) ----------
     The intro never waits more than ~700ms for WebGL; if the chunk is late, the
     sequence runs in pure HTML/CSS and the dust fades in afterwards as atmosphere. */
  const wait = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));
  const dustPromise = motion ? import('./dust') : null;
  let dustMod: typeof import('./dust') | null = dustPromise ? await Promise.race([dustPromise, wait(700)]) : null;
  const tier = dustMod ? dustMod.deviceTier() : motion ? 1 : 0;
  let dust: import('./dust').DustScene | null = null;
  const makeDust = (mod: typeof import('./dust')) => {
    const t = mod.deviceTier();
    if (t === 0) return null;
    try {
      const wordCount = t === 2 ? 9000 : 4200;
      const ambientCount = t === 2 ? 3800 : 1600;
      const d = new mod.DustScene(canvas, mod.textTargets(word, canvas, wordCount), { wordCount, ambientCount, size: t === 2 ? 3.6 : 3.0 });
      gsap.ticker.add(d.tick);
      hero.classList.add('has-dust');
      return d;
    } catch {
      return null;
    }
  };
  if (dustMod) {
    await Promise.race([document.fonts.ready, wait(500)]);
    dust = makeDust(dustMod);
  } else if (dustPromise) {
    dustPromise.then((mod) => {
      const d = makeDust(mod);
      if (!d) return;
      d.u.uForm.value = 1.2;
      d.u.uRelease.value = 1;
      gsap.to(d.u.uAlpha, { value: 1, duration: 1.6, ease: 'power2.out' });
    });
  }

  /* ---------- opening sequence ---------- */
  const seen = sessionStorage.getItem('hh-intro') === '1';
  try {
    sessionStorage.setItem('hh-intro', '1');
  } catch {}
  const k = seen ? 0.55 : 1; // quicker on repeat visits

  if (!motion || !root.classList.contains('intro')) {
    root.classList.remove('intro');
    if (dust) {
      dust.u.uAlpha.value = 1;
      dust.u.uForm.value = 1.2;
      dust.u.uRelease.value = 1;
    }
  } else {
    // Measure how far the group must sit so the word is alone at the visual centre.
    const gr = group.getBoundingClientRect();
    const wr = word.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    const offset = hr.top + hr.height / 2 - (wr.top + wr.height / 2);
    gsap.set(group, { y: offset });
    if (dust) dust.build(); // re-sample at the centred position
    root.classList.remove('intro');
    gsap.set(chars, { opacity: 0.04, yPercent: 30, filter: 'blur(14px)' });
    gsap.set(tagLines, { yPercent: 110, opacity: 0 });
    gsap.set(late, { opacity: 0, y: 24 });

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (dust) {
      tl.to(dust.u.uAlpha, { value: 1, duration: 0.6 * k, ease: 'power2.out' }, 0);
      tl.to(dust.u.uForm, { value: 1.15, duration: 1.9 * k, ease: 'power2.inOut' }, 0.05);
    }
    // the name resolves out of the light: "HEKAYAHAUS — strong and clean"
    tl.to(chars, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.1 * k, stagger: 0.045 * k }, dust ? 1.5 * k : 0.15);
    if (dust) tl.to(dust.u.uDim, { value: 0.12, duration: 0.9 * k, ease: 'power2.out' }, 1.85 * k);
    // hold, then release — "beyond seen, into felt"
    const rel = dust ? 2.9 * k : 1.5 * k;
    if (dust) {
      tl.to(dust.u.uRelease, { value: 1, duration: 2.4 * k, ease: 'power2.inOut' }, rel);
    }
    tl.to(group, { y: 0, duration: 1.4 * k, ease: 'expo.inOut' }, rel);
    tl.to(tagLines, { yPercent: 0, opacity: 1, duration: 1.2 * k, stagger: 0.14 * k }, rel + 0.55 * k);
    tl.to(late, { opacity: 1, y: 0, duration: 1 * k, stagger: 0.09 * k, clearProps: 'transform' }, rel + 0.95 * k);
    tl.add(() => {
      gsap.set(chars, { clearProps: 'filter' });
    });
  }

  /* ---------- hero scroll-out ---------- */
  if (motion) {
    gsap.to(hero.querySelector('.hero-inner'), {
      yPercent: -18,
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
    if (dust) {
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (s) => (dust!.u.uScroll.value = s.progress),
      });
    }
  }

  /* ---------- statement: words light up as you read ---------- */
  document.querySelectorAll<HTMLElement>('[data-scrub-words]').forEach((el) => {
    const words = el.querySelectorAll('.w');
    if (!motion) return;
    gsap.fromTo(
      words,
      { opacity: 0.55 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
      },
    );
  });

  /* ---------- pillars: stacked cards recede as the next arrives ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    const cards = gsap.utils.toArray<HTMLElement>('.pillar-card');
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card.querySelector('.pillar-inner'), {
        scale: 0.94,
        opacity: 0.35,
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true },
      });
    });

    /* legacy line drifts sideways with scroll */
    gsap.utils.toArray<HTMLElement>('[data-drift]').forEach((el) => {
      const dir = Number(el.dataset.drift) || -1;
      gsap.fromTo(el, { xPercent: dir > 0 ? -12 : 4 }, { xPercent: dir > 0 ? 4 : -12, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* featured work: horizontal pinned rail */
    const rail = document.querySelector<HTMLElement>('[data-rail]');
    const track = rail?.querySelector<HTMLElement>('.rail-track');
    if (rail && track) {
      const dist = () => track.scrollWidth - rail.clientWidth;
      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: rail,
          start: 'top top+=' + 0,
          end: () => '+=' + dist(),
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (s) => rail.style.setProperty('--p', String(s.progress)),
        },
      });
    }
  });

  /* ---------- process: active step drives the image stack ---------- */
  const steps = document.querySelectorAll<HTMLElement>('[data-step]');
  const frames = document.querySelectorAll<HTMLElement>('[data-step-img]');
  const bar = document.querySelector<HTMLElement>('[data-step-bar]');
  const setStep = (n: number) => {
    steps.forEach((s, i) => s.classList.toggle('is-active', i === n));
    frames.forEach((f, i) => f.classList.toggle('is-active', i === n));
    bar?.style.setProperty('--p', String((n + 1) / steps.length));
  };
  steps.forEach((s, i) => {
    ScrollTrigger.create({ trigger: s, start: 'top 60%', end: 'bottom 60%', onToggle: (st) => st.isActive && setStep(i) });
  });

  /* ---------- final CTA: dust gathers into the H mark ---------- */
  const endCanvas = document.querySelector<HTMLCanvasElement>('.end-canvas');
  if (!dustMod && dustPromise) dustMod = await dustPromise;
  if (endCanvas && dustMod && tier > 0) {
    const mod = dustMod;
    // Build the second scene only when the visitor is getting close to it.
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const img = new Image();
        img.src = '/media/brand/h-mark-160.png';
        await img.decode().catch(() => null);
        if (!img.naturalWidth) return;
        const narrow = window.innerWidth < 768;
        const count = tier === 2 ? 5200 : 2600;
        const end = new mod.DustScene(endCanvas, mod.imageTargets(img, narrow ? 0.62 : 0.5, count), {
          wordCount: count,
          ambientCount: tier === 2 ? 1800 : 900,
          size: 2.6,
          spread: 1.1,
        });
        end.u.uAlpha.value = 1;
        end.u.uDim.value = 0.75;
        gsap.ticker.add(end.tick);
        ScrollTrigger.create({
          trigger: endCanvas.parentElement,
          start: 'top 85%',
          end: 'center 55%',
          scrub: 1,
          onUpdate: (st) => (end.u.uForm.value = st.progress * 1.15),
        });
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(endCanvas);
  }

  ScrollTrigger.refresh();
}
