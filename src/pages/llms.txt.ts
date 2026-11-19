import type { APIRoute } from 'astro';
import { site, pillars, services, projects } from '../data/site';
export const GET: APIRoute = () => {
  const body = `# HekayaHaus

> ${site.tagline} ${site.positioning} • ${site.region}. ${site.description}

- Based in ${site.location}; serving the UAE, India, the USA and beyond.
- 200+ client and brand collaborations, including Red Bull, Nike, Lamborghini, EA Sports and Porsche.
- Contact: ${site.email} · WhatsApp ${site.whatsappDisplay} · Careers: ${site.hrEmail}

## Pillars
${pillars.map((p) => `- [${p.name}](${site.url}${p.route}): ${p.line} ${p.bullets.join('; ')}`).join('\n')}

## Services
${services.map((s) => `- [${s.name}](${site.url}/${s.slug}): ${s.intro}`).join('\n')}

## Portfolio
${projects.map((p) => `- [${p.title}](${site.url}/portfolio/${p.slug}): ${p.summary}`).join('\n')}

## Company
- [About](${site.url}/about)
- [Contact](${site.url}/contact-us)
- [Careers](${site.url}/careers)
- [Insights](${site.url}/blogs)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
