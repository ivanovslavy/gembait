# gembait.com Codebase Audit — Portfolio Integration Readiness

Audit date: 2026-04-18 · Working dir: `/gembait.com`

---

## 1. Project metadata

### `package.json`

```json
{
  "name": "gembait",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "express": "^5.2.1",
    "i18next": "^26.0.4",
    "marked": "^18.0.0",
    "nodemailer": "^8.0.5",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-helmet-async": "^3.0.0",
    "react-i18next": "^17.0.3",
    "react-router-dom": "^7.14.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/vite": "^4.2.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "tailwindcss": "^4.2.2",
    "vite": "^8.0.4"
  }
}
```

### Tool versions

```
node: v20.20.2
npm:  10.8.2
vite: 8.0.8 (linux-arm64)
```

### Top-level libraries

- **React 19.2** + react-dom 19.2
- **Routing:** react-router-dom 7.14
- **i18n:** i18next 26.0 + react-i18next 17.0
- **SEO/head:** react-helmet-async 3.0
- **Markdown:** marked 18
- **Styling:** Tailwind CSS 4.2 (via `@tailwindcss/vite`) + custom CSS variables (no PostCSS file — uses the new Vite plugin directly)
- **Backend:** express 5.2 + nodemailer 8.0 (single `server.cjs`, not bundled)
- No TypeScript. No test runner. No state library. No design-system library.

---

## 2. Root file inventory

### `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

### `eslint.config.js`

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#4F46E5" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

    <title>GEMBA IT — Technology That Works</title>
    <meta name="description" content="Full-stack software development, DevOps infrastructure, payment systems, Web3 blockchain solutions. Node.js, React, PostgreSQL, Solidity. Varna, Bulgaria." />
    <meta name="keywords" content="GEMBA IT, software development, DevOps, Node.js, React, PostgreSQL, blockchain, Solidity, payment integration, Stripe, PayPal, Web3, Bulgaria" />
    <meta name="author" content="GEMBA IT" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://gembait.com/" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://gembait.com/" />
    <meta property="og:title" content="GEMBA IT — Technology That Works" />
    <meta property="og:description" content="Full-stack development, DevOps, payment systems, Web3 solutions. We build, deploy, and maintain." />
    <meta property="og:image" content="https://gembait.com/favicon.svg" />
    <meta property="og:site_name" content="GEMBA IT" />
    <meta property="og:locale" content="en_US" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="GEMBA IT — Technology That Works" />
    <meta name="twitter:description" content="Full-stack development, DevOps, payment systems, Web3 solutions." />

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "name": "GEMBA IT",
      "url": "https://gembait.com",
      "logo": "https://gembait.com/favicon.svg",
      "description": "Full-stack software development, DevOps, payment integrations, Web3/blockchain solutions. Technology division of GEMBA Team.",
      "parentOrganization": {"@type": "Organization", "name": "GEMBA Team EOOD", "url": "https://gembateam.com"},
      "address": {"@type": "PostalAddress", "addressLocality": "Varna", "addressCountry": "BG"},
      "contactPoint": {"@type": "ContactPoint", "email": "contacts@gembait.com", "contactType": "customer service"},
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "IT Services",
        "itemListElement": [
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Linux Server Infrastructure & DevOps"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Backend Development & APIs (Node.js, Express)"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Database Architecture (PostgreSQL, MongoDB, MariaDB)"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "React Frontend & Web Applications"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Payment System Integration (Stripe, PayPal, Crypto)"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Web3 & Blockchain Development (Solidity, EVM)"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Smart Contract Audit"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Monitoring & Control Systems"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Access Control & Video Surveillance"}},
          {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "MVP Development"}}
        ]
      },
      "knowsAbout": ["Node.js", "React", "PostgreSQL", "MongoDB", "MariaDB", "Solidity", "Ethereum", "Docker", "Linux", "DevOps", "Stripe", "PayPal", "Cloudflare"]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "GEMBA IT",
      "url": "https://gembait.com",
      "inLanguage": ["en", "bg", "es"]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "GembaPay",
      "url": "https://gembapay.com",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "description": "Non-custodial payment gateway for crypto and fiat payments. Ethereum, BSC, Polygon. Certified Stripe and PayPal partner. 1% fee.",
      "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "1% per transaction, no monthly fees"}
    }
    </script>

    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### `server.cjs`

**Role:** Production backend API only — *not* a dev server, *not* an SSR server, *not* a blog server. The React app is built statically by Vite and served by Apache from `dist/`. Apache reverse-proxies only `/api/*` to this Node process.

- Listens on `127.0.0.1:$PORT`. systemd unit (`/etc/systemd/system/gembait.service`) sets `PORT=3081`.
- Routes:
  - `POST /api/contact` — contact form, Cloudflare Turnstile verification, nodemailer SMTP send
  - `POST /api/career` — careers/CV form, same Turnstile + SMTP path
  - `GET /api/health` — JSON health probe
- In-memory rate limit: 5 submissions / IP / hour.
- All env via systemd `Environment=`: `TURNSTILE_SECRET_KEY`, `SMTP_HOST/PORT/USER/PASS`, `CONTACT_EMAIL`, `SITE_NAME`.

```bash
#!/usr/bin/env node
# (full source already in repo — 242 lines, see /gembait.com/server.cjs)
```

### `auto-blog.sh`

```bash
#!/bin/bash
# ============================================================
# Automated Blog Writer for gembait.com
# Runs via cron - Claude Code writes a post and publishes it
#
# Setup cron (example: every Monday and Thursday at 9:00 AM):
#   crontab -e
#   0 9 * * 1,4 /gembait.com/auto-blog.sh >> /var/log/gembait-blog.log 2>&1
# ============================================================

set -e

SITE_DIR="/gembait.com"
BLOG_DIR="$SITE_DIR/content/blog"
LOG_PREFIX="[AUTO-BLOG $(date '+%Y-%m-%d %H:%M')]"

echo "$LOG_PREFIX Starting automated blog post creation..."

cd "$SITE_DIR"

# Run Claude Code in non-interactive mode with the blog writing task
claude -p --dangerously-skip-permissions "You are the blog writer for GEMBA IT. Read /gembait.com/content/blog/CLAUDE.md for your full instructions.

Your task: Write ONE new blog post.

IMPORTANT STEPS:
1. First, read posts.json to see what topics have been covered recently
2. Choose a topic from a DIFFERENT category than the last 2 posts
3. Search the web for current, interesting information on your chosen topic
4. Write the post in all 3 languages (en, bg, es) with 1-3 Unsplash images
5. Update posts.json with the new entry
6. Run: cd /gembait.com && node generate-sitemap.cjs && npm run build && sudo systemctl restart gembait

Use today's date: $(date '+%Y-%m-%d')

Write a high-quality, engaging post that readers will find genuinely useful or interesting." \
  --allowedTools "Read,Write,Bash" \
  --max-turns 30

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "$LOG_PREFIX Blog post created and published successfully."
else
    echo "$LOG_PREFIX Claude Code exited with code $EXIT_CODE"
fi

echo "$LOG_PREFIX Done."
```

### `publish-blog.sh`

```bash
#!/bin/bash
# Manually publish blog updates after a new post is added.
set -e
SITE_DIR="/gembait.com"
echo "=== Publishing Blog Updates ==="
cd "$SITE_DIR"
node generate-sitemap.cjs
npm run build
cp -f public/robots.txt dist/ 2>/dev/null || true
cp -f public/sitemap.xml dist/ 2>/dev/null || true
cp -f public/llms.txt dist/ 2>/dev/null || true
cp -f public/llms-full.txt dist/ 2>/dev/null || true
sudo systemctl reload apache2
echo "=== Blog Published Successfully ==="
echo "Visit: https://gembait.com/en/blog"
```

### `generate-sitemap.cjs`

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://gembait.com';
const LANGS = ['en', 'bg', 'es'];

const staticPages = [
  { path: '',          changefreq: 'weekly',  priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/products', changefreq: 'monthly', priority: '0.9' },
  { path: '/about',    changefreq: 'monthly', priority: '0.8' },
  { path: '/blog',     changefreq: 'weekly',  priority: '0.8' },
  { path: '/team',     changefreq: 'monthly', priority: '0.7' },
  { path: '/careers',  changefreq: 'weekly',  priority: '0.7' },
  { path: '/contact',  changefreq: 'monthly', priority: '0.8' },
];

let blogPosts = [];
const postsPath = path.join(__dirname, 'content', 'blog', 'posts.json');
if (fs.existsSync(postsPath)) {
  blogPosts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
}

function generateUrl(pagePath, changefreq, priority) {
  let xml = '';
  for (const lang of LANGS) {
    const loc = `${BASE_URL}/${lang}${pagePath}`;
    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    for (const altLang of LANGS) {
      xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${BASE_URL}/${altLang}${pagePath}"/>\n`;
    }
    if (lang === 'en') {
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/en${pagePath}"/>\n`;
    }
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${lang === 'en' ? priority : (parseFloat(priority) - 0.1).toFixed(1)}</priority>\n`;
    xml += '  </url>\n';
  }
  return xml;
}

let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
sitemap += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n';
for (const page of staticPages) {
  sitemap += `  <!-- ${page.path || 'Homepage'} -->\n`;
  sitemap += generateUrl(page.path, page.changefreq, page.priority);
  sitemap += '\n';
}
if (blogPosts.length > 0) {
  sitemap += '  <!-- Blog posts -->\n';
  for (const post of blogPosts) {
    sitemap += generateUrl(`/blog/${post.slug}`, 'monthly', '0.7');
  }
  sitemap += '\n';
}
sitemap += '</urlset>\n';

fs.writeFileSync(path.join(__dirname, 'public', 'sitemap.xml'), sitemap);
if (fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.writeFileSync(path.join(__dirname, 'dist', 'sitemap.xml'), sitemap);
}
```

### `README.md`

Boilerplate Vite-React template README — not project-specific. Two paragraphs about `@vitejs/plugin-react` (Oxc) vs `plugin-react-swc`, plus generic "expanding the ESLint configuration" guidance. Carries no domain documentation.

---

## 3. Routing map

### `src/App.jsx`

```jsx
import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SEOHead from './components/SEOHead';
import Home from './pages/Home';
import Services from './pages/Services';
import Products from './pages/Products';
import About from './pages/About';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Team from './pages/Team';
import Careers from './pages/Careers';
import Contact from './pages/Contact';

function LangWrapper({ children }) {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (lang && ['en', 'bg', 'es'].includes(lang) && i18n.language !== lang) i18n.changeLanguage(lang);
  }, [lang, i18n]);
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SEOHead />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/en" replace />} />
            <Route path="/:lang" element={<LangWrapper><Home /></LangWrapper>} />
            <Route path="/:lang/services" element={<LangWrapper><Services /></LangWrapper>} />
            <Route path="/:lang/products" element={<LangWrapper><Products /></LangWrapper>} />
            <Route path="/:lang/about" element={<LangWrapper><About /></LangWrapper>} />
            <Route path="/:lang/blog" element={<LangWrapper><Blog /></LangWrapper>} />
            <Route path="/:lang/blog/:slug" element={<LangWrapper><BlogPost /></LangWrapper>} />
            <Route path="/:lang/team" element={<LangWrapper><Team /></LangWrapper>} />
            <Route path="/:lang/careers" element={<LangWrapper><Careers /></LangWrapper>} />
            <Route path="/:lang/contact" element={<LangWrapper><Contact /></LangWrapper>} />
            <Route path="*" element={<Navigate to="/en" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}
```

### `src/main.jsx`

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './components/ThemeContext';
import './i18n/i18n';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
```

### Route table

| Path                          | Component  |
|-------------------------------|------------|
| `/`                           | redirect → `/en` |
| `/:lang`                      | `Home`     |
| `/:lang/services`             | `Services` |
| `/:lang/products`             | `Products` |
| `/:lang/about`                | `About`    |
| `/:lang/blog`                 | `Blog`     |
| `/:lang/blog/:slug`           | `BlogPost` |
| `/:lang/team`                 | `Team`     |
| `/:lang/careers`              | `Careers`  |
| `/:lang/contact`              | `Contact`  |
| `*` (any other)               | redirect → `/en` |

### Language prefix implementation

- Every locale-aware route is mounted under `/:lang`.
- `LangWrapper` reads the param, validates membership in `['en','bg','es']`, and calls `i18n.changeLanguage()` if it differs from the current language. No client-side validation against unknown 2-letter codes (any string is accepted by the router; only languages outside the whitelist are silently ignored without redirect).
- Footer's privacy/terms links point to `/:lang/privacy` and `/:lang/terms` — but **no routes exist** for those paths, so they fall through to the wildcard and redirect to `/en`.

### 404 handling

No dedicated `NotFound` page. The wildcard route silently redirects everything unknown to `/en`. From an SEO standpoint this means broken/typo URLs return 200 OK (SPA), which Google can flag as soft-404s.

---

## 4. Pages inventory

### `src/pages/Home.jsx` — 134 LOC
**What it renders.** Marketing homepage with five vertical sections: animated hero (logo + headline gradient), grid of 13 service cards, two product cards (GembaPay highlighted, Atlas placeholder), tech-stack badges, blog preview tiles, and a final CTA banner.
- **i18n keys used:** `hero.badge`, `hero.title1`, `hero.title_works`, `hero.title2`, `hero.title_understand`, `hero.subtitle`, `hero.cta`, `hero.cta2`, `services.page_title`, `services.subtitle`, `services.items`, `services.support_title`, `services.support_desc`, `products.page_title`, `products.subtitle`, `products.gembapay.{badge,name,type,desc,tags}`, `products.atlas.{badge,name,type,desc,tags}`, `tech.title`, `blog.page_title`, `blog.coming`, `blog.posts`, `contact.title`, `contact.subtitle`.
- **Components imported:** `Link` (RR), `useTranslation` (i18next), `GembaLogo`.
- **Hardcoded content:** `serviceIcons[]` (13 inline SVGs), `iconColors[]`, `iconBgs[]` (13 entries each, parallel to `t('services.items')` index). Tech stack list `['Node.js','React','PostgreSQL','MongoDB','MariaDB','Solidity','Linux','Docker','Cloudflare']`. First two of `iconColors`: `'#0E7490','#4F46E5'`. First two of tech stack: `Node.js`, `React`.

### `src/pages/Services.jsx` — 29 LOC
**What it renders.** Long-form services page: title, subtitle, vertical list of 13 service cards (title + description with a left gradient bar), a support-banner card, and a single CTA button to `/contact`.
- **i18n keys:** `services.page_title`, `services.subtitle`, `services.items`, `services.support_title`, `services.support_desc`, `hero.cta`.
- **Components imported:** `Link`, `useTranslation`.
- **Hardcoded content:** none — every service line comes from `services.items` in the JSON dictionaries.

### `src/pages/Products.jsx` — 31 LOC
**What it renders.** Two manually templated cards: GembaPay (live badge, gradient border, link out to gembapay.com) and Atlas ("In development" badge). No dynamic list, no detail pages.
- **i18n keys:** `products.page_title`, `products.subtitle`, `products.gembapay.{badge,name,type,desc,tags}`, `products.atlas.{badge,name,type,desc,tags}`.
- **Components imported:** `useTranslation`.
- **Hardcoded content:** product names embedded directly in JSX (two `<div>` blocks). No `products` array; the file would have to be edited in JSX for every new product.

### `src/pages/About.jsx` — 21 LOC
**What it renders.** "Not a typical software house" heading, five paragraphs (`p1`–`p5`) and a four-tile stats strip (20+ years, 3 networks, 13 service areas, 99.9% uptime).
- **i18n keys:** `about.title`, `about.p1`–`about.p5`, `about.stats.years_it`, `about.stats.networks`, `about.stats.service_areas`, `about.stats.uptime`.
- **Components:** `useTranslation`.
- **Hardcoded content:** `[{num:'20+',k:'years_it'},{num:'3',k:'networks'},{num:'13',k:'service_areas'},{num:'99.9%',k:'uptime'}]` — stat numbers themselves are hardcoded; only labels are i18n.

### `src/pages/Team.jsx` — 21 LOC
**What it renders.** Single leadership card for Slavcho Ivanov: avatar circle with initials "SI", name, role, bio, italicized tagline. No team list — one person only.
- **i18n keys:** `team.leadership`, `team.name`, `team.role`, `team.bio`, `team.tagline`.
- **Components:** `useTranslation`.
- **Hardcoded content:** initials "SI" in the avatar.

### `src/pages/Careers.jsx` — 70 LOC
**What it renders.** Intro, one open position card ("Marketing Specialist") with two-column needs/offers list, and a CV upload-style form (name/email/message + Cloudflare Turnstile). Submits to `POST /api/career`.
- **i18n keys:** `careers.intro_title`, `careers.intro`, `careers.open_positions`, `careers.marketing_title`, `careers.marketing_desc`, `careers.we_need`, `careers.needs`, `careers.we_offer`, `careers.offers`, `careers.no_role_title`, `careers.no_role`, `careers.send_cv`, `careers.apply`, `contact.form.{name,email,message,success,error,sending}`.
- **Components:** `useState`, `useEffect`, `useRef`, `useTranslation`. Inlines Turnstile widget (sitekey hardcoded `0x4AAAAAAC9x5sdEMg3SCV04`).
- **Hardcoded content:** Turnstile sitekey constant; "Remote" badge text in JSX (not translated).

### `src/pages/Contact.jsx` — 63 LOC
**What it renders.** Two-column layout: left column shows email, location, sister-site links (gembateam.com, gembaindustrial.com); right column is a 4-field form (name, email, subject, message + Turnstile). Submits to `POST /api/contact`.
- **i18n keys:** `contact.title`, `contact.subtitle`, `contact.email_label`, `contact.email`, `contact.location_label`, `contact.location`, `contact.operating`, `contact.form.{name,email,subject,message,send,sending,success,error}`.
- **Components:** `useState`, `useEffect`, `useRef`, `useTranslation`.
- **Hardcoded content:** Turnstile sitekey, sister-site URLs `gembateam.com`, `gembaindustrial.com`.

### `src/pages/Blog.jsx` — 100 LOC
**What it renders.** Index of all blog posts. Loads `content/blog/posts.json` at build time, sorts by date desc, renders each as a card with date/author, localized title and excerpt, and color-coded tag pills.
- **i18n keys:** `blog.page_title`. (Subtitle and tag colors are inlined per-language in JS — *not* in i18n JSON.)
- **Components:** `Link`, `useTranslation`.
- **Hardcoded content:** `tagColors{}` map for nine tags (payments, fintech, gembapay, devops, infrastructure, hetzner, web3, blockchain, business). First two entries: `payments → #059669` on `rgba(16,185,129,0.1)`; `fintech → #4F46E5` on `rgba(79,70,229,0.1)`. Three inline literal subtitle strings (en/bg/es).

### `src/pages/BlogPost.jsx` — 178 LOC
**What it renders.** Single blog post page. Looks up the slug in `posts.json`, dynamically imports the `{slug}.{lang}.md` raw text via `import.meta.glob('/content/blog/*.md', { query: '?raw' })`, falls back to English if the language file is missing, renders with `marked()` into a `dangerouslySetInnerHTML` block. Includes back link, header (date, author, tags), spinner during load, and a footer with prev/next-style nav.
- **i18n keys:** none (uses `useParams` for `lang` + `posts.json` for content). All UI labels are inlined per-language conditionals.
- **Components:** `useState`, `useEffect`, `useParams`, `Link`, `useTranslation`, `Helmet`, `marked`.
- **Hardcoded content:** Inline UI strings ("Post not found", "Back to blog" / "Към блога" / "Volver al blog", etc.).

---

## 5. Components inventory

### `src/components/Navbar.jsx` — 95 LOC
- **Props:** none. Reads `useTheme()`, `useTranslation()`, `useLocation()`, `useNavigate()`.
- **Purpose:** Sticky top navbar with logo, 7 nav links, language picker (flag dropdown), light/dark theme toggle, and mobile hamburger. Switches language by replacing the first path segment via `navigate()`.
- **Used in:** `src/App.jsx:4`.

### `src/components/Footer.jsx` — 49 LOC
- **Props:** none.
- **Purpose:** Four-column footer (brand blurb, services links, products links, sister-site links) plus copyright row with Privacy/Terms links and current year (`© 2026 …` is hardcoded text, not derived from `Date.now()`).
- **Used in:** `src/App.jsx:5`.

### `src/components/SEOHead.jsx` — 64 LOC
- **Props:** none. Reads `useTranslation()`, `useLocation()`.
- **Purpose:** Drives per-route `<title>`, `<meta description>`, canonical, hreflang alternates, OpenGraph tags, and an Organization JSON-LD block. Page key derived from path segment (`pathParts[1]` or `'home'`).
- **Used in:** `src/App.jsx:6`.

### `src/components/ThemeContext.jsx` — 26 LOC
- **Exports:** `ThemeProvider({ children })`, `useTheme()` → `{ dark, toggle }`.
- **Purpose:** Persists theme to `localStorage('gemba-theme')` and toggles `document.documentElement.classList.toggle('dark', dark)`. Initial value uses `prefers-color-scheme` if no saved value.
- **Used in:** `src/main.jsx:5`, `src/components/Navbar.jsx:4`.

### `src/components/GembaLogo.jsx` — 68 LOC
- **Props:** `{ size = 36, animated = false }`.
- **Purpose:** Renders the GEMBA brand SVG (concentric arcs + 5 anchor circles + cross-connecting lines). When `animated`, adds rotating outer ring + pulsing nodes + animated gradient.
- **Used in:** `src/pages/Home.jsx:3`, `src/components/Navbar.jsx:5`, `src/components/Footer.jsx:3`.

There is no `data/`, `hooks/`, or `utils/` directory.

---

## 6. i18n audit

### `src/i18n/i18n.js`

```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import bg from './bg.json';
import es from './es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bg: { translation: bg },
      es: { translation: es },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

No browser language detection — initial language is always `'en'`. `LangWrapper` later corrects from URL.

### Language file stats

| File   | LOC | Approx leaf strings |
|--------|----:|--------------------:|
| `en.json` | 139 | ~95 |
| `bg.json` |  74 | ~95 |
| `es.json` |  74 | ~95 |

Bulgarian and Spanish are visually denser (one-line objects). All three carry the same set of top-level keys.

### Top-level keys (all three locales)

`nav, hero, services, products, about, tech, blog, team, careers, contact, footer` (11 keys).

### Key-diff matrix

Differences are limited to a handful of helper keys; no major divergence.

| Key | en | bg | es | Notes |
|-----|:--:|:--:|:--:|-------|
| `about.page_title`  | ❌ | ✅ | ✅ | en uses `about.title` only; `page_title` is unused dead key in bg/es |
| `team.page_title`   | ❌ | ✅ | ✅ | Team.jsx uses `team.leadership`; `page_title` unused |
| `services.items[*].title/desc` | ✅ ×13 | ✅ ×13 | ✅ ×13 | Aligned by index |
| All other keys | ✅ | ✅ | ✅ | |

### Placeholder / stale-translation flags

- **`contact.email`** is `"contacts@gembait.com"` in all three files — fine (email shouldn't be translated).
- **`contact.location`** is "Varna, Bulgaria" / "Варна, България" / "Varna, Bulgaria" — Spanish keeps the English form; consistent with brand.
- **`careers.marketing_desc`** is short in bg/es ("Търсим маркетинг специалист…", "Buscamos un Especialista…") versus a full paragraph in en. Reads like a deliberate trim, but it does drop scope context.
- **No empty strings, no `TODO`, no `__` placeholders observed.** `t('blog.posts')` (the Home preview triplet) hardcodes pre-launch teaser text — these are now stale because real posts exist; the homepage shows fake "Coming soon" entries instead of the actual newest 3 posts from `content/blog/posts.json`.

---

## 7. Styling & design tokens

### `src/index.css`

```css
@import "tailwindcss";

@theme {
  --color-primary: #4F46E5;
  --color-primary-light: #6366F1;
  --color-accent: #06B6D4;
  --color-accent-dark: #0E7490;
  --font-display: 'Outfit', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

@layer base {
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-tertiary: #f1f3f5;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-tertiary: #9ca3af;
    --border-color: rgba(0, 0, 0, 0.08);
    --border-hover: rgba(0, 0, 0, 0.15);
    --card-bg: #ffffff;
    --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    --gradient-start: #4F46E5;
    --gradient-end: #06B6D4;
  }

  .dark {
    --bg-primary: #0a0e1a;
    --bg-secondary: #111827;
    --bg-tertiary: #1a1f2e;
    --text-primary: #e8e9ed;
    --text-secondary: #9ba1b4;
    --text-tertiary: #5e6472;
    --border-color: rgba(255, 255, 255, 0.08);
    --border-hover: rgba(255, 255, 255, 0.15);
    --card-bg: #151b2e;
    --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { font-family: var(--font-body); background-color: var(--bg-primary); color: var(--text-primary); transition: background-color 0.3s, color 0.3s; line-height: 1.6; }
}

.gradient-text { background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

.btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 12px 28px; background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end)); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: var(--font-body); cursor: pointer; transition: opacity 0.2s, transform 0.15s; text-decoration: none; }
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

.btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 12px 28px; background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; font-weight: 500; font-family: var(--font-body); cursor: pointer; transition: background 0.2s, border-color 0.2s; text-decoration: none; }
.btn-outline:hover { background: var(--bg-secondary); border-color: var(--border-hover); }

@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-up { animation: fadeUp 0.6s ease forwards; opacity: 0; }
.delay-100 { animation-delay: 0.1s; } .delay-200 { animation-delay: 0.2s; } .delay-300 { animation-delay: 0.3s; } .delay-400 { animation-delay: 0.4s; } .delay-500 { animation-delay: 0.5s; }

/* Blog content styles */
.blog-content { font-size: 16px; line-height: 1.8; color: var(--text-secondary); }
.blog-content h2 { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; color: var(--text-primary); margin-top: 2rem; margin-bottom: 0.75rem; }
.blog-content h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--text-primary); margin-top: 1.5rem; margin-bottom: 0.5rem; }
.blog-content p { margin-bottom: 1.25rem; }
.blog-content strong { color: var(--text-primary); font-weight: 600; }
.blog-content a { color: #4F46E5; text-decoration: none; border-bottom: 1px solid rgba(79, 70, 229, 0.3); transition: border-color 0.2s; }
.blog-content a:hover { border-color: #4F46E5; }
.blog-content ul, .blog-content ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
.blog-content li { margin-bottom: 0.5rem; }
.blog-content blockquote { border-left: 3px solid #4F46E5; padding-left: 1rem; margin: 1.5rem 0; font-style: italic; color: var(--text-tertiary); }
.blog-content code { font-family: var(--font-mono, 'Fira Code', monospace); font-size: 0.9em; padding: 2px 6px; border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); }
.blog-content pre { background: var(--bg-secondary); border-radius: 8px; padding: 1rem; overflow-x: auto; margin-bottom: 1.25rem; }
.blog-content pre code { padding: 0; background: none; }
.blog-content hr { border: none; border-top: 1px solid var(--border-color); margin: 2rem 0; }
.blog-content img { max-width: 100%; border-radius: 8px; margin: 1.5rem 0; }
.blog-content em { color: var(--text-tertiary); }
```

### CSS variables — light theme (`:root`)

| Variable | Value |
|---|---|
| `--bg-primary` | `#ffffff` |
| `--bg-secondary` | `#f8f9fa` |
| `--bg-tertiary` | `#f1f3f5` |
| `--text-primary` | `#111827` |
| `--text-secondary` | `#4b5563` |
| `--text-tertiary` | `#9ca3af` |
| `--border-color` | `rgba(0,0,0,0.08)` |
| `--border-hover` | `rgba(0,0,0,0.15)` |
| `--card-bg` | `#ffffff` |
| `--card-shadow` | `0 1px 3px rgba(0,0,0,0.04)` |
| `--gradient-start` | `#4F46E5` |
| `--gradient-end` | `#06B6D4` |

### CSS variables — dark theme (`.dark`)

Toggled by `ThemeProvider` adding/removing `class="dark"` on `<html>` (Tailwind v4 dark-mode pattern).

| Variable | Value |
|---|---|
| `--bg-primary` | `#0a0e1a` |
| `--bg-secondary` | `#111827` |
| `--bg-tertiary` | `#1a1f2e` |
| `--text-primary` | `#e8e9ed` |
| `--text-secondary` | `#9ba1b4` |
| `--text-tertiary` | `#5e6472` |
| `--border-color` | `rgba(255,255,255,0.08)` |
| `--border-hover` | `rgba(255,255,255,0.15)` |
| `--card-bg` | `#151b2e` |
| `--card-shadow` | `0 1px 3px rgba(0,0,0,0.2)` |

(Gradient variables are inherited from `:root`.)

### `src/components/ThemeContext.jsx`

```jsx
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('gemba-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('gemba-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Tailwind?

Yes — Tailwind 4.2 via `@tailwindcss/vite` (no `tailwind.config.*`, no `postcss.config.*`). Tokens declared inside the `@theme` block in `src/index.css`. Utility classes used heavily through the JSX (e.g. `flex`, `grid`, `text-sm`, `rounded-xl`, `lg:flex`).

### Fonts

- Loaded via Google Fonts in `index.html`:
  - **Outfit** (300/400/500/600/700) → `--font-display`
  - **DM Sans** (400/500) → `--font-body`
- No `@import` in CSS; preconnect hints to `fonts.googleapis.com` and `fonts.gstatic.com`.

### Primary palette in use

- **Indigo** `#4F46E5` (primary)
- **Indigo light** `#6366F1`
- **Cyan** `#06B6D4` (accent)
- **Cyan dark** `#0E7490`
- Status accents reused across pages: emerald `#059669`, violet `#7C3AED`, red `#DC2626`, amber `#D97706`, gray `#4B5563`.
- Brand gradient (everywhere): `linear-gradient(135deg, #4F46E5, #06B6D4)`.

---

## 8. SEO infrastructure

### `src/components/SEOHead.jsx`

```jsx
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const meta = {
  en: {
    home: { title: 'GEMBA IT — Technology That Works', desc: 'Full-stack software development, DevOps, payment systems, Web3 solutions. We build, deploy, and maintain.' },
    services: { title: 'Services — GEMBA IT', desc: 'Linux servers, backend APIs, React frontend, payment integrations, blockchain, monitoring, and more.' },
    products: { title: 'Products — GEMBA IT', desc: 'GembaPay payment gateway and Atlas workforce management platform.' },
    about: { title: 'About — GEMBA IT', desc: 'Not a typical software house. Built on combined industrial and digital expertise.' },
    blog: { title: 'Blog — GEMBA IT', desc: 'Insights on technology, DevOps, Web3, and development practices.' },
    team: { title: 'Team — GEMBA IT', desc: 'Meet the team behind GEMBA IT.' },
    careers: { title: 'Careers — GEMBA IT', desc: 'Join GEMBA IT. We are looking for talented people.' },
    contact: { title: 'Contact — GEMBA IT', desc: 'Get in touch with GEMBA IT for your next project.' },
  },
  bg: { /* same shape, BG strings */ },
  es: { /* same shape, ES strings */ },
};

export default function SEOHead() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const lang = i18n.language || 'en';
  const pathParts = location.pathname.split('/').filter(Boolean);
  const page = pathParts[1] || 'home';
  const pageMeta = meta[lang]?.[page] || meta[lang]?.home || meta.en.home;
  const baseUrl = 'https://gembait.com';
  const canonicalUrl = `${baseUrl}${location.pathname}`;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{pageMeta.title}</title>
      <meta name="description" content={pageMeta.desc} />
      <link rel="canonical" href={canonicalUrl} />
      {['en','bg','es'].map(l => <link key={l} rel="alternate" hrefLang={l} href={`${baseUrl}/${l}${pathParts[1] ? '/' + pathParts[1] : ''}`} />)}
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}/en${pathParts[1] ? '/' + pathParts[1] : ''}`} />
      <meta property="og:title" content={pageMeta.title} />
      <meta property="og:description" content={pageMeta.desc} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="GEMBA IT" />
      <script type="application/ld+json">{JSON.stringify({ '@context':'https://schema.org','@type':'Organization', name:'GEMBA IT', url:'https://gembait.com', description:pageMeta.desc, parentOrganization:{name:'GEMBA Team EOOD',url:'https://gembateam.com'}, address:{'@type':'PostalAddress', addressLocality:'Varna', addressCountry:'BG'}})}</script>
    </Helmet>
  );
}
```

### `public/robots.txt`

```
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://gembait.com/sitemap.xml

# AI model documentation
# See https://gembait.com/llms.txt for AI-readable company info
# See https://gembait.com/llms-full.txt for detailed documentation

# AI Crawlers - Welcome
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: CCBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Applebot-Extended
Allow: /
```

### `public/llms.txt`

```text
# GEMBA IT

> GEMBA IT is the technology division of GEMBA Team EOOD — a Bulgarian software development and DevOps company based in Varna, Bulgaria. We specialize in Linux server infrastructure, full-stack web development, payment system integration, and Web3/blockchain solutions. Founded by Slavcho Ivanov, who combines 20+ years of IT expertise with 10+ years of industrial experience at major European refineries.

## Services

### Infrastructure & DevOps
- Linux server setup, hardening, monitoring, and scaling on Hetzner cloud
- CI/CD pipelines, automated deployments, failover configurations
- Database architecture: PostgreSQL, MongoDB, MariaDB — design, replication, optimization, backup strategies
- Real-time monitoring dashboards for server processes and industrial infrastructure

### Software Development
- Backend: Node.js/Express.js, RESTful and GraphQL APIs
- Frontend: React single-page applications, progressive web apps, responsive design
- Corporate and personal websites, multi-language, SEO-optimized
- Custom admin panels with role-based access control
- MVP development from concept to functional prototype

### Payment Systems
- Stripe Connect marketplace integration
- PayPal PPCP (Connected Path) integration
- Cryptocurrency payment processing (Ethereum, BSC, Polygon)
- Non-custodial payment architecture — merchants receive funds directly
- Expanding partnerships with additional payment processors for high-risk verticals

### Web3 & Blockchain
- Smart contract development on EVM-compatible networks (Solidity)
- Smart contract security auditing (Slither, Mythril)
- Ethereum, Binance Smart Chain, Polygon deployment
- DApp development and blockchain integration

### Physical Security & Access
- Access control systems: digital check-in/check-out for workforce management
- Video surveillance: CCTV with alarm notifications, security company (SOT) compatibility, server-based recording

### Ongoing Support
- Monthly subscription plans for maintenance, monitoring, bug fixes, feature development, and security updates

## Products

### GembaPay (gembapay.com) — Live
Non-custodial payment gateway. Single API for crypto + fiat payments. Supports Ethereum, BSC, Polygon. Certified Stripe marketplace and PayPal partner. 1% fee. Open-source blockchain protocols.

### Atlas — In Development
Modular SaaS for industrial workforce management. Shift planning, check-in/check-out, inventory, digital permits, integrated office suite, AI assistant. Docker self-hosted option for enterprise clients.

## Technology Stack
Node.js, React, Express.js, PostgreSQL, MongoDB, MariaDB, Solidity, Linux, Docker, Cloudflare, Hetzner Cloud, Apache, systemd

## Contact
- Website: https://gembait.com
- Email: contacts@gembait.com
- Location: Varna, Bulgaria
- Serving clients across Europe

## Parent Company
GEMBA Team EOOD (EIK: 208656371) — https://gembateam.com

## Links
- GembaPay: https://gembapay.com
- Industrial Services: https://gembaindustrial.com
- GitHub: https://github.com/ivanovslavy
- LinkedIn (DevOps): https://linkedin.com/in/slavy-ivanov
- LinkedIn (Industrial): https://linkedin.com/in/slavcho-ivanov
```

(There is no `public/llms-full.txt` despite `publish-blog.sh` and `robots.txt` referencing it.)

### `public/sitemap.xml`

- **Total URL count:** 42 (= 8 static pages × 3 langs + 6 blog posts × 3 langs).
- **First 10 `<loc>`:**
  ```
  https://gembait.com/en
  https://gembait.com/bg
  https://gembait.com/es
  https://gembait.com/en/services
  https://gembait.com/bg/services
  https://gembait.com/es/services
  https://gembait.com/en/products
  https://gembait.com/bg/products
  https://gembait.com/es/products
  https://gembait.com/en/about
  ```
- **Last 5 `<loc>`:**
  ```
  https://gembait.com/bg/blog/iot-safety-monitoring-industrial-plants
  https://gembait.com/es/blog/iot-safety-monitoring-industrial-plants
  https://gembait.com/en/blog/web3-for-traditional-businesses
  https://gembait.com/bg/blog/web3-for-traditional-businesses
  https://gembait.com/es/blog/web3-for-traditional-businesses
  ```

### Per-page meta data flow

```
URL  →  React Router parses /:lang/<page>
                 │
                 ▼
        SEOHead reads useLocation() + i18n.language
                 │
                 ▼
        meta[lang][page] lookup (3 langs × 8 pages, hardcoded inside SEOHead.jsx)
                 │
                 ▼
        <Helmet> emits:  <html lang>, <title>, <meta description>,
                         <link canonical>, hreflang alternates,
                         OpenGraph (title, description, url, type=website, site_name),
                         Organization JSON-LD with the page description
```

`BlogPost.jsx` bypasses `SEOHead` for its own `<Helmet>` block (article title/description/og:type=article/article:tag/article:author). Index.html provides three baseline `<script type="application/ld+json">` blocks at boot: ProfessionalService, WebSite, SoftwareApplication (GembaPay). No per-product OG image, no SoftwareApplication entries beyond GembaPay, no Twitter card on per-page Helmet (only baseline `summary` in index.html).

---

## 9. Blog system deep dive

### `src/pages/Blog.jsx`

(See section 4 — full source already in tree.) Static `import` of `posts.json`, sort by date descending, render cards with localized title/excerpt and color-coded tag chips. Subtitle and "back/contact" labels are inline-conditional per language, *not* in i18n JSON.

### `src/pages/BlogPost.jsx`

Loads markdown with `import.meta.glob('/content/blog/*.md', { query: '?raw', import: 'default' })`. Each language version is a separate `.md` file. Falls back to `.en.md` if the requested locale isn't on disk. Pipes raw markdown through `marked()` and renders with `dangerouslySetInnerHTML`. Wraps a `<Helmet>` with article-shaped meta (og:type=article, article:published_time, article:author, article:tag).

### `content/` directory tree

```
content/blog/CLAUDE.md                                       (writer instructions for Claude Code)
content/blog/posts.json                                      (manifest, see below)
content/blog/ai-powered-cyberattacks-2026.{en,bg,es}.md
content/blog/building-failover-infrastructure-on-a-budget.{en,bg,es}.md
content/blog/iot-safety-monitoring-industrial-plants.{en,bg,es}.md
content/blog/postgresql-streaming-replication-high-availability.{en,bg,es}.md
content/blog/web3-for-traditional-businesses.{en,bg,es}.md
content/blog/why-non-custodial-payments-matter.{en,bg,es}.md
```

File-type summary: 1 × JSON manifest, 1 × CLAUDE.md instructions, 18 × Markdown (6 slugs × 3 languages).

### Total existing posts

**6 posts** (× 3 languages = 18 markdown files). All dated 2026-04-15. All authored by "Slavcho Ivanov".

### Runtime loading

- `posts.json` is statically imported by both `Blog.jsx` and `BlogPost.jsx` → bundled into the JS at build time (no fetch).
- Markdown bodies are lazy-imported via Vite's `import.meta.glob('/content/blog/*.md', { query: '?raw' })` — each `.md` becomes its own JS chunk (visible in `dist/assets/<slug>.<lang>-<hash>.js`).
- Server-side `server.cjs` does **not** participate in blog delivery. Apache serves the prebuilt JS chunks; the SPA fetches them on demand.

### Publish pipeline

- `auto-blog.sh` (cron-friendly): cd's to `/gembait.com`, invokes `claude -p --dangerously-skip-permissions` headless with explicit prompt to read `content/blog/CLAUDE.md`, choose a topic from a different category than the last two posts, write 3-language markdown, append to `posts.json`, then run `node generate-sitemap.cjs && npm run build && sudo systemctl restart gembait`. Logs to `/var/log/gembait-blog.log`.
- `publish-blog.sh` (manual): regenerate sitemap → `npm run build` → copy SEO statics (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`) into `dist/` → `sudo systemctl reload apache2`.
- `generate-sitemap.cjs`: reads `content/blog/posts.json`, emits `public/sitemap.xml` and (if `dist/` exists) `dist/sitemap.xml` with hreflang alternates per locale.
- Note: the auto-blog script restarts `gembait.service` (the API) instead of reloading Apache; the build artifacts are picked up by Apache automatically because Apache serves `dist/` directly. The systemd restart is not strictly necessary for publishing static blog content but doesn't hurt.

---

## 10. Current Products page state

### `src/pages/Products.jsx` (full)

```jsx
import { useTranslation } from 'react-i18next';

export default function Products() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('products.page_title')}</h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)' }}>{t('products.subtitle')}</p>
      {/* GembaPay */}
      <div className="rounded-xl p-6 mb-6 relative overflow-hidden animate-fade-up delay-200" style={{ backgroundColor: 'var(--card-bg)', border: '2px solid rgba(79,70,229,0.3)' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #4F46E5, #06B6D4)' }} />
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(5,150,105,0.08)', color: '#059669' }}>{t('products.gembapay.badge')}</span>
        </div>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('products.gembapay.name')}</h2>
        <p className="text-sm font-medium mb-4 gradient-text">{t('products.gembapay.type')}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('products.gembapay.desc')}</p>
        <div className="flex flex-wrap gap-2 mb-4">{t('products.gembapay.tags', { returnObjects: true }).map(tag => <span key={tag} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{tag}</span>)}</div>
        <a href="https://gembapay.com" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">gembapay.com →</a>
      </div>
      {/* Atlas */}
      <div className="rounded-xl p-6 relative overflow-hidden animate-fade-up delay-300" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #D97706, #F59E0B)' }} />
        <span className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-4" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#D97706' }}>{t('products.atlas.badge')}</span>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('products.atlas.name')}</h2>
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>{t('products.atlas.type')}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('products.atlas.desc')}</p>
        <div className="flex flex-wrap gap-2">{t('products.atlas.tags', { returnObjects: true }).map(tag => <span key={tag} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{tag}</span>)}</div>
      </div>
    </div>
  );
}
```

### Products data file

**Does not exist.** No `src/data/`, `src/data/products.*`, no per-product JSON. All product content is either inlined in `Products.jsx` JSX or pulled from the `products.*` namespace in the i18n files.

### Current product entries

| # | Name | One-line description (current site copy) |
|---|------|------------------------------------------|
| 1 | **GembaPay** | Non-custodial payment gateway — single API for crypto + fiat, Ethereum/BSC/Polygon, Stripe + PayPal partner, 1% fee. |
| 2 | **Atlas** | Modular SaaS for industrial workforce management — shifts, check-in/out, inventory, digital permits, AI assistant, Docker self-host. |

### Comparison vs. 10 target products

| Target product | Present? | Where |
|---|---|---|
| **GembaTools** | ❌ Missing on gembait.com (lives at `gembatools.conf` Apache vhost; no card on this site) |
| **GembaPay** | ✅ Featured (Home + Products + Footer) |
| **GembaTicket** | ❌ Missing entirely |
| **EduChain** | ❌ Missing entirely |
| **GembaEscrow** | ❌ Missing entirely |
| **GembaWin** | ❌ Missing entirely |
| **Kotkata NFT** | ❌ Missing entirely |
| **NFT Viewer** | ❌ Missing entirely |
| **BRSCPPRewards** | ❌ Missing entirely |
| **GembaRewards** | ❌ Missing entirely |
| (legacy) Atlas | ✅ Present — not on the new 10-list; will need a decision (keep, retire, fold into a product) |

**Score: 1 of 10 target products covered (GembaPay).** The other product card on the page (Atlas) is not on the requested portfolio list.

### Detail-page route

**There is no dynamic product route.** No `/:lang/products/:slug`. No `ProductDetail.jsx` or `ProductPage.jsx`. The only outbound option is the GembaPay external link.

---

## 11. Current Services page state

### `src/pages/Services.jsx` (full)

```jsx
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Services() {
  const { t, i18n } = useTranslation();
  const services = t('services.items', { returnObjects: true });
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-up" style={{ fontFamily: 'var(--font-display)' }}>{t('services.page_title')}</h1>
      <p className="text-base mb-10 animate-fade-up delay-100" style={{ color: 'var(--text-secondary)' }}>{t('services.subtitle')}</p>
      <div className="space-y-4 animate-fade-up delay-200">
        {services.map((svc, i) => (
          <div key={i} className="rounded-xl p-5 relative overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #4F46E5, #06B6D4)' }} />
            <h3 className="text-base font-semibold mb-1 pl-3" style={{ fontFamily: 'var(--font-display)' }}>{svc.title}</h3>
            <p className="text-sm pl-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{svc.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl p-5 animate-fade-up delay-300" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <h3 className="text-base font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t('services.support_title')}</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('services.support_desc')}</p>
      </div>
      <div className="mt-8 text-center">
        <Link to={`/${i18n.language}/contact`} className="btn-primary">{t('hero.cta')} →</Link>
      </div>
    </div>
  );
}
```

### Current 13 services

(Index-aligned to `iconColors`/`iconBgs` on Home.jsx.)

1. Linux servers & DevOps
2. Backend & APIs (Node.js / Express)
3. Database architecture (PostgreSQL, MongoDB, MariaDB)
4. React frontend
5. Payment integrations (Stripe, PayPal, crypto)
6. Web3 & blockchain (EVM smart contracts)
7. Smart contract audit
8. Monitoring systems
9. Admin panels
10. Access control
11. Video surveillance
12. Websites
13. MVP development

### Source of service content

- Driven entirely by `services.items[]` in `en.json` / `bg.json` / `es.json`.
- Icons are inlined in `Home.jsx` only (Services.jsx uses a flat gradient bar instead of icons).
- Support banner uses two extra keys: `services.support_title`, `services.support_desc`.

---

## 12. Careers, About, Team, Contact

### About (`src/pages/About.jsx`)
- Title `t('about.title')` ("Not a typical software house") + 5 paragraphs `about.p1..p5`.
- 4 stat tiles: `20+` years in IT, `3` blockchain networks, `13` service areas, `99.9%` uptime — numbers hardcoded in JSX, labels from `about.stats.*`.
- No images, no team grid, no timeline, no awards.
- Source: i18n only.

### Team (`src/pages/Team.jsx`)
- Single-card layout for Slavcho Ivanov: avatar disc with hardcoded "SI" initials, name, role, bio paragraph, italic tagline.
- No data structure for additional teammates; adding a second person requires JSX duplication.
- Source: i18n keys `team.{leadership, name, role, bio, tagline}`.

### Careers (`src/pages/Careers.jsx`)
- Intro block + one open role: "Marketing Specialist (Remote)" with two-column needs/offers list.
- "Don't see your role?" CV form (name, email, message, Turnstile) → `POST /api/career`.
- Single position; no listing repeater. Source: i18n keys under `careers.*` plus form labels reused from `contact.form.*`.

### Contact (`src/pages/Contact.jsx`)
- Left column: email link, location label, sister-site links (`gembateam.com`, `gembaindustrial.com`).
- Right column: 4-field form (name, email, subject, message) + Turnstile → `POST /api/contact`.
- No phone, no address block, no booking widget, no map, no business hours.
- Source: i18n keys `contact.*` (email/location are also stored as i18n strings).

---

## 13. Build & deploy state

### `dist/`

```
dist/                        684K total
├── assets/                  20 hashed JS chunks + 1 CSS
├── favicon.svg
├── icons.svg
├── index.html               (5,278 bytes)
├── llms.txt
├── robots.txt
├── sitemap.xml              (20,481 bytes)
└── .well-known/
```

Newest dist file mtime → **2026-04-15 22:42 UTC** (most recent `npm run build`).

### Apache vhost — `/etc/apache2/sites-enabled/gembait.com.conf`

```apache
<VirtualHost *:80>
    ServerName gembait.com
    ServerAlias www.gembait.com
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName gembait.com
    ServerAlias www.gembait.com

    SSLEngine on
    SSLCertificateFile /etc/ssl/gembait.com/cert.pem
    SSLCertificateKeyFile /etc/ssl/gembait.com/key.pem

    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:3081/api
    ProxyPassReverse /api http://127.0.0.1:3081/api

    DocumentRoot /gembait.com/dist
    <Directory /gembait.com/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    <Directory /gembait.com/dist/assets>
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>

    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
    </IfModule>

    ErrorLog ${APACHE_LOG_DIR}/gembait-error.log
    CustomLog ${APACHE_LOG_DIR}/gembait-access.log combined
</VirtualHost>
```

### systemd — `/etc/systemd/system/gembait.service`

```ini
[Unit]
Description=GEMBA IT Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/gembait.com
ExecStart=/usr/bin/node /gembait.com/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3081
Environment=TURNSTILE_SECRET_KEY=…
Environment=SMTP_HOST=smtp.gmail.com
Environment=SMTP_PORT=587
Environment=SMTP_USER=ivanovslavy@gmail.com
Environment=SMTP_PASS=…
Environment=CONTACT_EMAIL=contacts@gembait.com
Environment=SITE_NAME=GEMBA IT

[Install]
WantedBy=multi-user.target
```

(Secrets redacted in this report; live values are present in the unit file.)

### Active GEMBA-related systemd services (from `systemctl list-units --type=service`)

```
gembait.service                            running   GEMBA IT Backend API            (port 3081)
gembateam.service                          running   GEMBA Team Backend API
gembaindustrial.service                    running   GEMBA Industrial Backend API
gembatools.service                         running   Gemba Tools Frontend
gembapay-api.service                       running   GembaPay Backend API
gembapay-listener.service                  running   GembaPay Blockchain Event Listener
gembapay-marketing.service                 running   GembaPay Marketing Frontend
gembapay-merchant-dashboard.service        running   GembaPay Merchant Dashboard
gembapay-owner-dashboard.service           running   GembaPay Owner Dashboard
gembapay-payment.service                   running   GembaPay Payment App Frontend
gembapay-testshop-backend.service          running   GembaPay TestShop Backend
gembapay-testshop-frontend.service         running   GembaPay TestShop Frontend
listener-testnet.gembapay.service          running   GembaPay Testnet Event Listener
```

(Useful context: most of the products in the target list already have running services on this server, suggesting they could be linked from the new product detail pages.)

### Listening ports (visible to this user)

```
LISTEN  127.0.0.1:3082   (separate Node process — NOT gembait.service)
LISTEN  *:3083           (separate Node process)
```

`gembait.service` runs on `127.0.0.1:3081` per its env var; that socket is owned by `root` and was not visible in the unprivileged `ss` output. Apache's `ProxyPass /api → 127.0.0.1:3081` matches the systemd `PORT=3081`; no mismatch.

### Cloudflare

External — not inspectable from the server.

---

## 14. Gap analysis (opinion)

### Missing infrastructure
1. **No dynamic product route.** `Products.jsx` is two hand-rolled cards. Adding 9 more by JSX duplication is not viable; there is no `/:lang/products/:slug` route, no `ProductDetail.jsx`.
2. **No products data file.** `src/data/products.js` (or `.json`) doesn't exist; no canonical place to declare product slug, name, tagline, hero image, tech stack, status, target audience, primary CTA URL, screenshots, case-study link.
3. **No image asset directory** (`public/products/<slug>/...` is not provisioned).
4. **No 404 page.** Wildcard route silently redirects → soft-404 SEO risk. Footer links to `/:lang/privacy` and `/:lang/terms` which don't exist.
5. **Blog Markdown content path is brittle.** `content/blog/*.md` is loaded via `import.meta.glob('/content/blog/*.md', …)` — that resolves at build time, but the leading `/` is project-root-relative in Vite. It works, but the glob would silently break if `content/` were moved.
6. **No reusable card or product components.** Every page hand-rolls its own card markup with inline styles. A `ProductCard`, `Section`, `MetricStat`, `TagPill`, `CTABanner` primitive set would dramatically shorten the upcoming product pages.
7. **Tag colors are duplicated** between `Blog.jsx` (a per-tag color map) and `posts.json` tag list — no single source of truth.

### Missing content
- **9 of 10 target products absent:** GembaTools, GembaTicket, EduChain, GembaEscrow, GembaWin, Kotkata NFT, NFT Viewer, BRSCPPRewards, GembaRewards.
- **Atlas remains in i18n/Home/Products/Footer** but is not on the requested portfolio list — needs an explicit keep/retire decision.
- **Team page has 1 person.** Anyone else who should be visible (advisors, ops, security) is invisible.
- **About page has no proof:** no client logos, no metrics beyond the four hardcoded numbers, no awards, no certifications shown.
- **Careers page has 1 open role only.** If portfolio scaling means more hiring, the page needs a list/filter primitive.
- **Footer "Products" column** still lists Atlas alongside GembaPay — both because there are only two products. Will need product navigation taxonomy.

### i18n debt
- **`blog.posts` triplet on Home is stale.** It still hardcodes "Coming soon" placeholders for 3 fictitious posts even though 6 real blog posts exist on disk. The home blog preview is not pulling from `posts.json`.
- **Inline UI labels** for Blog subtitle and BlogPost back/contact/post-not-found strings live as JS conditionals — should be moved into `blog.*` JSON for a single source of truth.
- **Dead keys `about.page_title` and `team.page_title`** exist in bg/es but are never read.
- **bg/es career copy is shorter** than en (notably `careers.marketing_desc`); not a defect, but worth a review pass.
- **No locale exists for product detail content** yet — a new namespace `products.<slug>.*` will be required for each new product across all three languages.

### B2B conversion gaps
- **No case-study template.** Nothing tells a buyer "we built X for Y, achieved Z metric in N weeks."
- **No metrics / social proof component.** The four About stats (20+, 3, 13, 99.9%) are isolated and decorative.
- **No client logo strip.**
- **No testimonial / quote component.**
- **No demo / sandbox links** beyond the external GembaPay site.
- **No lead-capture variant.** Only generic Contact and CV forms. No "Book a 15-min call" / Calendly embed, no "Download case study (PDF)" gated form, no per-product "Request a demo" path.
- **No pricing page or pricing JSON-LD.** Even an indicative range or "starting at" line is absent for everything except GembaPay's 1% fee, mentioned in copy.
- **No newsletter / drip signup**, even though a blog publishes regularly.

### SEO gaps
- **Product pages absent from sitemap** (because they don't exist yet). Every new product needs three sitemap entries (en/bg/es) with hreflang.
- **No JSON-LD `SoftwareApplication`** entries except for GembaPay (in `index.html`). Each product should emit its own `SoftwareApplication`/`WebApplication` block with screenshot, applicationCategory, operatingSystem, offers, aggregateRating where defensible.
- **No per-product OG image.** `og:image` defaults to `favicon.svg` everywhere — link previews on Slack/LinkedIn/Twitter look generic.
- **No Twitter Card on per-page Helmet.** Only baseline `summary` declared in `index.html`; per-page Helmet doesn't emit Twitter tags.
- **`SEOHead.jsx` uses path-segment matching** (`pathParts[1]`) and falls back to `home`. A `/:lang/products/:slug` route would resolve to `pathParts[1] = 'products'` and incorrectly use the Products page meta for every detail page.
- **Footer links to `/:lang/privacy` and `/:lang/terms` 404 (soft).** Crawlers see `200 OK` SPA shell — bad signal.
- **`llms.txt`** still describes only GembaPay + Atlas — needs to reflect the full portfolio.
- **`llms-full.txt`** is referenced in `robots.txt` and `publish-blog.sh` but does not exist on disk.
- **Sitemap drops `/team`, `/careers`, `/contact`** under low-priority but never adds product URLs. Generator needs awareness of products data.
- **Blog post `<title>`** in `BlogPost.jsx` is `"<title> — GEMBA IT Blog"` — fine, but no blog-archive ItemList JSON-LD and no `BreadcrumbList`.

---

## 15. Recommended integration plan (opinion)

Sprints assume 1–2 days each. No code in this report — only intent and acceptance.

### Sprint 1 — Data model & routing foundation
1. **Create `src/data/products.js`.** Single source of truth for all 10 products.
   - AC: exports an array of `{ slug, status, name, tagline, category, audience, tech: [...], features: [...], links: { live, github, demo }, ogImage, screenshots: [...] }`.
   - AC: includes all 10 target products (GembaTools, GembaPay, GembaTicket, EduChain, GembaEscrow, GembaWin, Kotkata NFT, NFT Viewer, BRSCPPRewards, GembaRewards).
   - AC: imported by both `Products.jsx` and the new detail page without further changes.
2. **Add product detail route `/:lang/products/:slug`.**
   - AC: new `pages/ProductDetail.jsx` resolves the param against `data/products.js`.
   - AC: a real `NotFound.jsx` renders for unknown slugs (and also wires into the `*` route — replace the silent redirect).
   - AC: `Products.jsx` becomes a list view rendering all 10 cards from data, each linking to its detail route.
3. **Reusable primitives.** Extract `ProductCard`, `Section`, `TagPill`, `MetricStat`, `CTABanner` into `src/components/`.
   - AC: at least Products, ProductDetail, and About pick them up; visual parity preserved.

### Sprint 2 — Per-product i18n & content
4. **Add `products.<slug>` namespace** to en/bg/es with `name`, `tagline`, `description`, `features[]`, `tags[]`, `cta`.
   - AC: 10 namespaces exist in all 3 languages.
   - AC: no untranslated en strings appear in bg/es output (manual inspection).
5. **Refresh Home.jsx product preview** to pull the top 4 from `data/products.js` instead of hardcoded GembaPay/Atlas.
   - AC: featured order is data-driven; "View all" link goes to `/products`.
6. **Refresh Footer.jsx product column** to render the same data-driven top 4–6.
   - AC: dead Atlas link decision recorded (keep or remove from data).

### Sprint 3 — SEO surface for new pages
7. **SEOHead per-page handling for `:slug`.**
   - AC: `SEOHead` reads `pathParts[1] === 'products' && pathParts[2]` and merges product-specific title/description/og:image/canonical.
   - AC: hreflang alternates point at the localized detail URL.
8. **JSON-LD per product.** Each detail page emits a `SoftwareApplication` (or `Product`) block with name, description, applicationCategory, operatingSystem, screenshot URLs, offers if priced.
   - AC: validates green in Google Rich Results Test for at least 3 products.
9. **Sitemap regeneration.**
   - AC: `generate-sitemap.cjs` reads `data/products.js` and emits 10 × 3 = 30 product URLs with hreflang.
   - AC: `npm run build` followed by sitemap regeneration produces a `dist/sitemap.xml` containing all product URLs.
10. **OG images per product.** Add `public/og/<slug>.png` (1200×630).
    - AC: every product detail page resolves to a unique `og:image` in `view-source`.

### Sprint 4 — B2B conversion layer
11. **Case-study template.** `src/components/CaseStudy.jsx` with hero metric, problem, solution, outcome, client quote, tech stack pill row.
    - AC: at least one product (GembaPay or GembaTools) renders an embedded case study at the bottom of its detail page.
12. **Logos / metrics strip on About + Home.** Even a curated 4–6 partner names (Stripe, PayPal, Hetzner, Cloudflare, etc.) earns trust.
    - AC: `MetricStat` reused for "20+ years / 99.9% uptime / N projects shipped" with at least 4 figures wired to data, not JSX.
13. **Lead capture variant: "Book a call".**
    - AC: a `BookCall` component embeds a Calendly (or equivalent) in a modal; CTA appears on Home, Products list, every Product detail.
    - AC: AC: a small Plausible/Cloudflare event ping fires on form submit (no PII).

### Sprint 5 — Content polish & gap fills
14. **Privacy & Terms pages.** Real routes `/:lang/privacy`, `/:lang/terms` with stub content.
    - AC: footer links resolve to a 200 OK page with localized content; not the wildcard redirect.
15. **Repair Home blog preview.** Replace stale `blog.posts` i18n triplet with dynamic top-3 from `posts.json`.
    - AC: home shows real post titles/dates linking to actual posts.
16. **Refresh `llms.txt` + create `llms-full.txt`.** Include the new 10-product catalog and link to each detail URL.
    - AC: file count matches references in `robots.txt` and `publish-blog.sh`.
17. **Drop `about.page_title` + `team.page_title` dead keys.** Tidy the i18n delta matrix.
    - AC: bg/es each lose 2 unused keys; a one-time `t('…page_title')` grep returns no callsites.

### Sprint 6 — QA & launch
18. **Cross-browser visual QA**, including dark mode and the Bulgarian + Spanish locales for every new product page.
19. **Lighthouse / PageSpeed run** on at least 3 product detail URLs; aim ≥ 90 for SEO and Best Practices.
20. **Sitemap re-submission** to Google Search Console + smoke check that hreflang reciprocity is valid.

---

*End of audit.*
