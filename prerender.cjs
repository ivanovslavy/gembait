#!/usr/bin/env node

/**
 * Static per-blog-post HTML prerenderer for gembait.com.
 *
 * Reason: SPA crawlers (Facebook, LinkedIn, Twitter, WhatsApp, Slack, Discord)
 * do NOT execute JS, so react-helmet-async tags injected at runtime are invisible
 * to them. Without per-post static HTML, every shared blog URL surfaces the
 * site-wide defaults from dist/index.html.
 *
 * For each post in content/blog/posts.json this script writes
 * dist/<lang>/blog/<slug>/index.html — a copy of the SPA shell with the
 * <head> rewritten to article-specific OG, Twitter, and canonical tags.
 *
 * The Apache rewrite is unchanged: real files win, so the prerendered HTML
 * is served first; the SPA fallback handles everything else.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://gembait.com';
const SITE_NAME = 'GEMBA IT';
const LANGS = ['en', 'bg', 'es'];
const TITLE_SUFFIX = ' | GEMBA IT Blog';

const distDir = path.join(__dirname, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const baseBackupPath = path.join(distDir, 'index.spa.html');

if (!fs.existsSync(distIndexPath)) {
  console.error('prerender: dist/index.html not found — run vite build first.');
  process.exit(1);
}

// Preserve the build output so re-runs always read the original SPA shell,
// even if a previous run corrupted dist/index.html somehow.
if (!fs.existsSync(baseBackupPath)) {
  fs.copyFileSync(distIndexPath, baseBackupPath);
}
const baseHtml = fs.readFileSync(baseBackupPath, 'utf-8');

const postsPath = path.join(__dirname, 'content', 'blog', 'posts.json');
if (!fs.existsSync(postsPath)) {
  console.log('prerender: no posts.json — skipping blog prerender.');
  process.exit(0);
}
const blogPosts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function pickLang(field, lang) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.en || Object.values(field)[0] || '';
}

function localeFor(lang) {
  return lang === 'bg' ? 'bg_BG' : lang === 'es' ? 'es_ES' : 'en_US';
}

function renderArticleHead({ lang, slug, post, title, description }) {
  const canonicalPath = `/${lang}/blog/${slug}`;
  const canonical = `${BASE_URL}${canonicalPath}`;
  const altLinks = LANGS.map(
    (l) => `    <link rel="alternate" hreflang="${l}" href="${BASE_URL}/${l}/blog/${slug}" />`
  ).join('\n');
  const xDefault = `    <link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/blog/${slug}" />`;

  const ogImage = post.hero
    ? `${BASE_URL}${post.hero}`
    : `${BASE_URL}/og/default.png`;
  const twitterCard = post.hero ? 'summary_large_image' : 'summary';

  const tagsMeta = (post.tags || [])
    .map((t) => `\n    <meta property="article:tag" content="${escapeAttr(t)}" />`)
    .join('');

  const imageDims = post.hero
    ? `
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeAttr(title)}" />`
    : '';

  return `    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#4F46E5" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

    <title>${escapeAttr(title + TITLE_SUFFIX)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="author" content="${escapeAttr(post.author || SITE_NAME)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
${altLinks}
${xDefault}

    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${ogImage}" />${imageDims}
    <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
    <meta property="og:locale" content="${localeFor(lang)}" />
    <meta property="article:published_time" content="${escapeAttr(post.date || '')}" />
    <meta property="article:modified_time" content="${escapeAttr(post.lastUpdated || post.date || '')}" />
    <meta property="article:author" content="${escapeAttr(post.author || SITE_NAME)}" />${tagsMeta}

    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${ogImage}" />`;
}

// Extract existing scripts/styles + JSON-LD so the prerendered HTML still boots the SPA
function extractAssetsBlock(html) {
  const re = /<script src="https:\/\/challenges\.cloudflare\.com[^"]+"[^>]*><\/script>|<script type="module"[^<]*<\/script>|<link rel="stylesheet"[^>]*\/?>(?:\s*<\/link>)?/g;
  return (html.match(re) || []).join('\n    ');
}

function extractJsonLdBlocks(html) {
  const re = /<script type="application\/ld\+json">[\s\S]*?<\/script>/g;
  return html.match(re) || [];
}

const assetsBlock = extractAssetsBlock(baseHtml);
const jsonLd = extractJsonLdBlocks(baseHtml).join('\n    ');

function buildHtml({ lang, slug, post, title, description }) {
  const head = renderArticleHead({ lang, slug, post, title, description });
  return `<!doctype html>
<html lang="${lang}">
  <head>
${head}

    ${jsonLd}

    ${assetsBlock}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
}

function writePage(relativePath, html) {
  const outPath = path.join(distDir, relativePath, 'index.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`  wrote ${path.relative(distDir, outPath)}`);
}

console.log('Prerendering per-blog-post HTML...');

let written = 0;
for (const post of blogPosts) {
  const slug = post.slug;
  if (!slug) continue;

  const titleField = post.title;
  const excerptField = post.excerpt || post.summary;

  for (const lang of LANGS) {
    // Only emit a page for languages that actually have content.
    // For nested-by-lang shape: skip if this lang's title is missing.
    // For flat-string shape: only emit en (the only available language for these posts).
    let title;
    let description;
    if (typeof titleField === 'object' && titleField !== null) {
      if (!titleField[lang]) continue;
      title = titleField[lang];
      description = pickLang(excerptField, lang);
    } else {
      if (lang !== 'en') continue;
      title = titleField || slug;
      description = pickLang(excerptField, 'en') || title;
    }

    const html = buildHtml({ lang, slug, post, title, description });
    writePage(`/${lang}/blog/${slug}`, html);
    written++;
  }
}

console.log(`Prerender done — wrote ${written} blog post pages.`);
