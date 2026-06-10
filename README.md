# GEMBA IT — Technology That Works

Marketing & portfolio site for **GEMBA IT** — a full‑stack software, DevOps and Web3
studio based in Varna, Bulgaria.

🌐 **Live:** https://gembait.com

---

## Overview

GEMBA IT designs and ships production software end to end: full‑stack web applications,
DevOps and cloud infrastructure, payment systems, and Web3 / blockchain solutions. This
repository holds the source of the public site — a fast, fully bilingual (BG/EN),
SEO‑optimised single‑page application.

## Tech stack

- **Frontend:** React 19 + Vite, Tailwind CSS
- **i18n:** in‑app BG/EN translations
- **Server:** Node.js (`server.cjs`) for static serving, prerendering and SEO endpoints
- **Quality:** ESLint, Vite production build

## Getting started

```bash
# prerequisites: Node.js 20+
npm install
npm run dev        # local dev server with HMR
npm run build      # production build → dist/
npm run preview    # preview the production build
```

Serve the built site:

```bash
node server.cjs    # serves dist/ + API/SEO routes
```

## Project structure

```
src/            UI components, pages, i18n
public/         static assets
dist/           production build (generated)
server.cjs      Node static + SEO/prerender server
vite.config.js  build configuration
```

## Deployment

The site is built to `dist/` and served by `server.cjs` behind Apache (reverse proxy)
with TLS terminated through Cloudflare (Full strict). Secrets (e.g. content/blog API
keys) live only in a local, untracked `.env` file.

## License

Released under the [MIT License](./LICENSE).

---

© 2026 GEMBA IT · Varna, Bulgaria
