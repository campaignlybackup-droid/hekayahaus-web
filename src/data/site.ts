import content from './content.json';

export type ImageMeta = { w: number; h: number; widths: number[]; alt: string };
export type Video = { id: string; title: string; provider: 'youtube' | 'vimeo' | 'file'; ref: string; poster: string; watchUrl: string };
export type Service = (typeof content.services)[number];
export type Pillar = (typeof content.pillars)[number];
export type Project = (typeof content.projects)[number];
export type Article = (typeof content.articles)[number];

export const site = {
  ...content.site,
  copyright: `© ${new Date().getFullYear()} HekayaHaus. All rights reserved.`,
};

export const images = content.images as Record<string, ImageMeta>;
export const logos = content.logos;
export const stats = content.stats;
export const processSteps = content.process;
export const faq = content.faq;
export const pillars = content.pillars;
export const services = content.services;
export const projects = content.projects;
export const featuredProjectSlugs = content.featuredProjects;
export const insightCategories = content.insightCats;
export const articles = content.articles;

export const videos = content.videos as Record<'showreel' | 'productionReel' | 'brandFilm', Video>;

/** From the live site: why-choose-us points, signature capabilities and service overview cards. */
export const whyChoose = content.whyChoose;
export const signature = content.signature;
export const helpCards = content.helpCards;
/** Further clients named in the HekayaHaus brand film (no logo files yet). */
export const moreClients = content.moreClients;

/**
 * Showreels. The brief plans one combined showreel plus one reel per service.
 * Add a service reel here (by service slug) once it is published; until then the
 * service page falls back to the closest existing reel.
 */
export const serviceReels: Record<string, Video | undefined> = {
  'media-production-dubai': videos.productionReel,
};

/** Press, recognition & features. Add exhibition/award entries (and a `logo` path) as they come in. */
export const featuredIn: { name: string; detail: string; href?: string; kind: string; logo?: string }[] = [
  {
    name: 'UAE Stories',
    kind: 'Feature story',
    detail: 'Nimit Thawrani: Fearless Founder of HekayaHaus',
    href: 'https://uaestories.com/nimit-thawrani-fearless/',
  },
  {
    name: 'Khaleej Times KT+150',
    kind: 'Recognition',
    detail: 'Recognising the UAE’s next generation of changemakers',
    href: 'https://www.khaleejtimes.com/uae/khaleej-times-kt150-list-uae-young-innovators',
  },
  { name: 'AAFT', kind: 'Featured Alumni', detail: 'Recognising our journey through its Featured Alumni initiative' },
  { name: 'AAFT', kind: 'Entrepreneurship & Mentorship', detail: 'Sharing experience with the next generation of founders' },
];

export const nav = {
  main: [
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'What We Do', href: '/what-we-do' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact-us' },
  ],
  join: {
    label: 'Join the Haus',
    items: [
      { label: 'Careers — Join the Haus', href: '/careers', note: 'Roles, internships & freelance' },
      { label: 'University Partnerships', href: '/university-partnerships', note: 'Placements & industry projects' },
      { label: 'Mentorship & Collaborations', href: '/mentorship-collaborations', note: 'Share, learn, build together' },
    ],
  },
};

export const imgSrc = (name: string, width = 1440) => {
  const meta = images[name];
  if (!meta) return `/media/img/${name}-960.webp`;
  const w = [...meta.widths].reverse().find((x) => x <= width) ?? meta.widths[0];
  return `/media/img/${name}-${w}.webp`;
};

export const servicesByPillar = (id: string) => services.filter((s) => s.pillar === id);
export const projectsByPillar = (id: string) => projects.filter((p) => p.pillar === id);
export const pillarById = (id: string) => pillars.find((p) => p.id === id)!;

export const youtubeEmbed = (v: Video) =>
  v.provider === 'file'
    ? v.ref
    : v.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${v.ref}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : `https://player.vimeo.com/video/${v.ref}?autoplay=1&title=0&byline=0&portrait=0`;
