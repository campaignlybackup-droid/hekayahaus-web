export function initFilter() {
  const grid = document.querySelector<HTMLElement>('[data-filter-grid]');
  const count = document.querySelector<HTMLElement>('[data-filter-count]');
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
  if (!grid) return;
  const items = Array.from(grid.children) as HTMLElement[];
  const apply = (f: string) => {
    let n = 0;
    items.forEach((el) => {
      const show = f === 'all' || el.dataset.pillar === f;
      el.hidden = !show;
      if (show) {
        n++;
        el.classList.add('in');
      }
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    if (count) count.textContent = `${n} project${n === 1 ? '' : 's'}`;
  };
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const f = b.dataset.filter!;
      const go = () => apply(f);
      const d = document as any;
      if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(go);
      else go();
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => ScrollTrigger.refresh());
    }),
  );
  const initial = new URLSearchParams(location.search).get('pillar');
  if (initial && Array.from(buttons).some((b) => b.dataset.filter === initial)) apply(initial);
}
