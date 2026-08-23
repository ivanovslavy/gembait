#!/usr/bin/env node

/**
 * Static prerenderer for gembait.com — homepages, static pages, and product detail pages.
 *
 * Reason: Apache returns 403 for directories without index.html and the SPA fallback
 * does not catch them (because the directory exists, Apache stops before the rewrite).
 * Additionally, when SPA fallback does take over, it serves dist/index.html whose
 * canonical points to the homepage, causing every URL to be flagged in Search Console
 * as a duplicate of "/".
 *
 * For each route in `staticMeta` × LANGS, and for each product × LANGS, this script
 * writes dist/<lang>/<page>/index.html (or dist/<lang>/index.html for the homepage)
 * — a copy of the SPA shell with the <head> rewritten to per-route canonical, title,
 * description, og:* and hreflang tags.
 *
 * Blog posts are handled by the existing prerender.cjs (left untouched).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { products } from './src/data/products.js';
import { pricingServices } from './src/data/pricing.js';
import { staticMeta } from './src/data/seoMeta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://gembait.com';
const SITE_NAME = 'GEMBA IT';
const LANGS = ['en', 'bg', 'es'];
const LOCALE = { en: 'en_US', bg: 'bg_BG', es: 'es_ES' };

// Routes covered here. The "key" maps to staticMeta[lang][key] and the "subPath"
// is the path segment after /<lang>. Empty subPath = the language homepage.
const STATIC_ROUTES = [
  { key: 'home',     subPath: '' },
  { key: 'services', subPath: '/services' },
  { key: 'pricing',  subPath: '/pricing' },
  { key: 'products', subPath: '/products' },
  { key: 'blog',     subPath: '/blog' },
  { key: 'about',    subPath: '/about' },
  { key: 'team',     subPath: '/team' },
  { key: 'careers',  subPath: '/careers' },
  { key: 'contact',  subPath: '/contact' },
  { key: 'privacy',  subPath: '/privacy' },
  { key: 'terms',    subPath: '/terms' },
];

const distDir = path.join(__dirname, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const baseBackupPath = path.join(distDir, 'index.spa.html');

if (!fs.existsSync(distIndexPath)) {
  console.error('prerender-pages: dist/index.html not found — run vite build first.');
  process.exit(1);
}

// prerender.cjs already maintains index.spa.html as the canonical SPA shell;
// fall back to dist/index.html if for some reason the backup is missing.
const baseHtml = fs.existsSync(baseBackupPath)
  ? fs.readFileSync(baseBackupPath, 'utf-8')
  : fs.readFileSync(distIndexPath, 'utf-8');

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// Reuse the same script/style extraction that prerender.cjs uses, so the
// prerendered shell still boots the SPA on the client.
function extractAssetsBlock(html) {
  const re = /<script src="https:\/\/challenges\.cloudflare\.com[^"]+"[^>]*><\/script>|<script type="module"[^<]*<\/script>|<link rel="stylesheet"[^>]*\/?>(?:\s*<\/link>)?/g;
  return (html.match(re) || []).join('\n    ');
}

function extractJsonLdBlocks(html) {
  const re = /<script type="application\/ld\+json">[\s\S]*?<\/script>/g;
  return html.match(re) || [];
}

const assetsBlock = extractAssetsBlock(baseHtml);
const baseJsonLd = extractJsonLdBlocks(baseHtml).join('\n    ');

function altLinksFor(subPath) {
  const lines = LANGS.map(
    (l) => `    <link rel="alternate" hreflang="${l}" href="${BASE_URL}/${l}${subPath}" />`
  );
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${BASE_URL}/en${subPath}" />`);
  return lines.join('\n');
}

function localeAlternates(lang) {
  return LANGS
    .filter((l) => l !== lang)
    .map((l) => `    <meta property="og:locale:alternate" content="${LOCALE[l]}" />`)
    .join('\n');
}

function renderHead({ lang, subPath, title, description, ogImage, jsonLdExtra }) {
  const canonical = `${BASE_URL}/${lang}${subPath}`;
  const ogType = 'website';
  const altLinks = altLinksFor(subPath);
  const localeAlt = localeAlternates(lang);
  const jsonLdBlock = jsonLdExtra
    ? `${baseJsonLd}\n    <script type="application/ld+json">${JSON.stringify(jsonLdExtra)}</script>`
    : baseJsonLd;

  return `    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#4F46E5" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

    <title>${escapeAttr(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="author" content="${escapeAttr(SITE_NAME)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
${altLinks}

    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeAttr(title)}" />
    <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
    <meta property="og:locale" content="${LOCALE[lang]}" />
${localeAlt}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${ogImage}" />

    ${jsonLdBlock}`;
}

function buildHtml({ lang, subPath, title, description, ogImage, jsonLdExtra }) {
  const head = renderHead({ lang, subPath, title, description, ogImage, jsonLdExtra });
  return `<!doctype html>
<html lang="${lang}">
  <head>
${head}

    ${assetsBlock}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
}

function writePage(relativeDir, html) {
  const outDir = path.join(distDir, relativeDir);
  const outPath = path.join(outDir, 'index.html');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`  wrote ${path.relative(distDir, outPath)}`);
}

console.log('Prerendering static pages and product detail pages...');

let written = 0;

// ---- Static routes (homepage + 9 sections) × 3 langs = 30 pages ----
for (const lang of LANGS) {
  const meta = staticMeta[lang];
  if (!meta) continue;

  for (const route of STATIC_ROUTES) {
    const m = meta[route.key];
    if (!m) continue;

    const ogImage = route.key === 'pricing'
      ? `${BASE_URL}/og/pricing.png`
      : `${BASE_URL}/og/default.png`;
    const html = buildHtml({
      lang,
      subPath: route.subPath,
      title: m.title,
      description: m.desc,
      ogImage,
    });
    writePage(`/${lang}${route.subPath}`, html);
    written++;
  }
}

// ---- Product detail pages × 3 langs ----
const sortedProducts = [...products].sort((a, b) => a.order - b.order);
for (const lang of LANGS) {
  for (const product of sortedProducts) {
    const subPath = `/products/${product.slug}`;
    const title = `${product.name} — ${SITE_NAME}`;
    // Fall back to the products page description when we have no per-product copy
    // available outside of the i18n bundle (the runtime SEOHead pulls per-product
    // tagline/cardDescription via i18next, which we can't trivially load here).
    const description = staticMeta[lang]?.products?.desc || staticMeta.en.products.desc;
    const ogImage = `${BASE_URL}/og/${product.slug}.png`;

    const jsonLdExtra = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: product.name,
      url: `${BASE_URL}/${lang}${subPath}`,
      description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
      image: ogImage,
    };

    const html = buildHtml({
      lang,
      subPath,
      title,
      description,
      ogImage,
      jsonLdExtra,
    });
    writePage(`/${lang}${subPath}`, html);
    written++;
  }
}

// ---- Pricing detail pages (12 services) × 3 langs ----
const sortedPricing = [...pricingServices].sort((a, b) => a.order - b.order);
for (const lang of LANGS) {
  for (const svc of sortedPricing) {
    const subPath = `/pricing/${svc.slug}`;
    const title = `${svc.name} — ${SITE_NAME}`;
    const description = staticMeta[lang]?.pricing?.desc || staticMeta.en.pricing.desc;
    const ogImage = `${BASE_URL}/og/pricing-${svc.slug}.png`;
    const jsonLdExtra = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: svc.name,
      url: `${BASE_URL}/${lang}${subPath}`,
      description,
      provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
      offers: { '@type': 'Offer', price: String(svc.basePrice), priceCurrency: 'EUR', description: 'Base price — full scope quoted per written offer.' },
    };
    const html = buildHtml({ lang, subPath, title, description, ogImage, jsonLdExtra });
    writePage(`/${lang}${subPath}`, html);
    written++;
  }
}

console.log(`Prerender-pages done — wrote ${written} pages.`);
