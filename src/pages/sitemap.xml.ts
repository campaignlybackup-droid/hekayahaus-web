import type { APIRoute } from 'astro';
import { projects, pillars, services, articles } from '../data/site';
export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/', '/portfolio', '/what-we-do', '/about', '/blogs', '/contact-us', '/careers', '/university-partnerships', '/mentorship-collaborations', '/privacy-policy', '/terms',
    ...pillars.map((p) => p.route),
    ...services.map((s) => `/${s.slug}`),
    ...projects.map((p) => `/portfolio/${p.slug}`),
    ...articles.map((a) => `/blogs/${a.slug}`),
  ];
  const urls = paths.map((p) => `<url><loc>${new URL(p, site).href.replace(/\/$/, p === '/' ? '/' : '')}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
};
