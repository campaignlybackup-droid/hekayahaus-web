/** Boots standalone, already-assembled Haus objects (About page). */
import { gsap } from 'gsap';

export function initHaus() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-haus]').forEach((stage) => {
    const canvas = stage.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || reduce) return;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const { deviceTier } = await import('./dust');
        const tier = deviceTier();
        if (tier === 0) return;
        const { HausScene } = await import('./haus3d');
        const scene = new HausScene(canvas, { quality: tier === 2 ? 2 : 1, assembled: false, draggable: true });
        // assemble once on arrival, then stay as one Haus
        const st = { p: 0 };
        gsap.to(st, { p: 1, duration: 3.2, ease: 'power3.inOut', onUpdate: () => (scene.progress = st.p) });
        gsap.ticker.add(scene.tick);
        stage.classList.add('has-haus');
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(stage);
  });
}
