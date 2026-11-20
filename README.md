# HekayaHaus — website

**Beyond Seen. Into Felt.** The HekayaHaus website: Astro (static HTML for every page), Three.js for the signature light-dust scenes, GSAP + ScrollTrigger and Lenis for motion, and two Vercel functions for the enquiry and application forms.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview
```

Deploy on Vercel: import the repo. The framework preset is Astro, and the `api/` folder deploys as functions automatically. `vercel.json` holds clean URLs, the redirects from the old routes (`/work/*`, `/allserviceshekayahaus`, `/contact`, `/insights`, `/join-the-haus`) and cache headers.

### Form email (optional but recommended)

The Contact and Careers forms post to `/api/contact` and `/api/apply`, which send email through [Resend](https://resend.com). Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | required to send |
| `MAIL_FROM` | verified sender, e.g. `HekayaHaus Website <website@hekayahaus.com>` |
| `CONTACT_TO` | defaults to `info@hekayahaus.com` |
| `APPLY_TO` | defaults to `hr@hekayahaus.com` |

Without a key, the forms still work. Visitors get a one-click "send by email" button with everything they typed already filled in.

## Editing content

Almost all copy lives in data files:

- `src/data/content.json` holds the pillars, services (with FAQs), portfolio projects, the insights article, stats, client logos and image metadata.
- `src/data/site.ts` holds navigation, the **Featured in** list (UAE Stories, KT+150, AAFT…), and the **service showreels** map.
- Homepage copy is in `src/pages/index.astro`. Each other page is its own file in `src/pages/`.

Common tasks:

- **Add a service showreel:** add an entry to `serviceReels` in `src/data/site.ts`, keyed by the service slug, e.g. `'content-marketing-dubai'`. A "Watch the reel" button appears on that service page.
- **Replace the main showreel:** edit `videos.showreel` in `content.json` (YouTube ID in `ref`).
- **Brand film:** the HekayaHaus film from the live site is self-hosted. `public/media/video/haus-film-720.mp4` (with sound) plays in the pop-up from *Watch Showreel*. `haus-loop-720.mp4` and `haus-loop-360.mp4` are silent 14-second loops used behind the showreel card; they load only when scrolled into view (360p on phones) and pause offscreen. To swap the film, replace these files and `haus-film-poster-*.webp`.
- **Live-site content:** `whyChoose`, `signature`, `helpCards` and `moreClients` in `content.json` hold the four "why choose us" points, the six signature capabilities, the six service overview cards, and the further clients named in the brand film.
- **Case-study detail:** add any of `client`, `brief`, `challenge`, `thinking`, `execution`, `outcome` (strings) to a project in `content.json`. Each section renders only when real, approved copy exists. Never invent results.
- **Press, exhibition or award logos:** add entries to `featuredIn` in `site.ts`, and put logo files in `public/media/logos/`.
- **University logos:** add them to `/university-partnerships` only once a partnership is formally established.
- **Images:** `public/media/img/{name}-{480|960|1440|2200}.webp`, registered in `content.json → images`.

## How it's built

- **Hero:** ~9k GPU particles (4k on mobile) gather into HEKAYAHAUS. The crisp HTML word resolves out of the light, then the dust releases into atmosphere as BEYOND SEEN. INTO FELT. appears. The pointer gently parts the dust. The final CTA reforms the dust into the H mark as you scroll. One draw call per scene, rendering pauses offscreen and in hidden tabs, and the scenes are skipped on low-power devices or Save-Data.
- **Progressive enhancement:** every word is real HTML. With JavaScript off, WebGL unavailable or reduced motion on, the full site renders without the effects.
- **SEO / AI search:** per-page titles and meta, Open Graph, JSON-LD (Organization, WebSite, Service, FAQPage, CreativeWork, Article), `sitemap.xml`, `robots.txt` and `llms.txt`.
