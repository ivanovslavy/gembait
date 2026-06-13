#!/usr/bin/env node

/**
 * Sitemap Generator for gembait.com
 * ES module variant so it can import products.js directly.
 * Run: node generate-sitemap.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { products } from './src/data/products.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://gembait.com';
const LANGS = ['en', 'bg', 'es'];

const staticPages = [
  { path: '', changefreq: 'weekly', priority: '1.0' },
  { path: '/products', changefreq: 'monthly', priority: '0.9' },
  { path: '/services', changefreq: 'monthly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/team', changefreq: 'monthly', priority: '0.7' },
  { path: '/careers', changefreq: 'weekly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
];

const postsPath = path.join(__dirname, 'content', 'blog', 'posts.json');
const blogPosts = fs.existsSync(postsPath)
  ? JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  : [];

function bumpDown(priority) {
  const n = Math.max(0.1, parseFloat(priority) - 0.1);
  return n.toFixed(1);
}

function urlBlock(pathSuffix, changefreq, priority, langs = LANGS) {
  let xml = '';
  for (const lang of langs) {
    const loc = `${BASE_URL}/${lang}${pathSuffix}`;
    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    for (const altLang of langs) {
      xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${BASE_URL}/${altLang}${pathSuffix}"/>\n`;
    }
    if (langs.includes('en')) {
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/en${pathSuffix}"/>\n`;
    }
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${lang === 'en' ? priority : bumpDown(priority)}</priority>\n`;
    xml += '  </url>\n';
  }
  return xml;
}

// Languages a blog post is actually translated into — mirrors prerender.cjs, which
// only emits a page per language that has content. Without this the sitemap lists
// phantom /bg and /es URLs for English-only posts, which Search Console then reports
// as Soft 404 / duplicate (no prerendered page exists for them).
function postLangs(post) {
  const t = post.title;
  if (t && typeof t === 'object') {
    const langs = LANGS.filter((l) => t[l]);
    return langs.length ? langs : ['en'];
  }
  return ['en'];
}

let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
sitemap += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n';

sitemap += '  <!-- Static pages -->\n';
for (const page of staticPages) {
  sitemap += urlBlock(page.path, page.changefreq, page.priority);
}

sitemap += '\n  <!-- Product detail pages -->\n';
for (const product of [...products].sort((a, b) => a.order - b.order)) {
  sitemap += urlBlock(`/products/${product.slug}`, 'monthly', '0.9');
}

if (blogPosts.length > 0) {
  sitemap += '\n  <!-- Blog posts (only the languages each post is translated into) -->\n';
  for (const post of blogPosts) {
    sitemap += urlBlock(`/blog/${post.slug}`, 'monthly', '0.7', postLangs(post));
  }
}

sitemap += '\n</urlset>\n';

const outputPath = path.join(__dirname, 'public', 'sitemap.xml');
const distOutputPath = path.join(__dirname, 'dist', 'sitemap.xml');
fs.writeFileSync(outputPath, sitemap);

const urlCount = (sitemap.match(/<url>/g) || []).length;
const blogUrlCount = blogPosts.reduce((n, p) => n + postLangs(p).length, 0);
console.log(
  `Sitemap generated: ${outputPath} — ${urlCount} URLs ` +
    `(${staticPages.length} static × 3 + ${products.length} products × 3 + ${blogUrlCount} blog URLs across ${blogPosts.length} posts)`
);

if (fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.writeFileSync(distOutputPath, sitemap);
  console.log(`Sitemap copied to: ${distOutputPath}`);
}
