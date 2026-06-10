#!/usr/bin/env node

/**
 * OG image generator for gembait.com
 * Emits one 1200x630 SVG per product (+ a default), and rasterizes to PNG
 * via sharp. Matte aesthetic — dark background, one tiny brand accent line,
 * pure typography otherwise. See Sprint 3 spec, Part B.
 *
 * Run: node scripts/generate-og-images.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { products } from '../src/data/products.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'og');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG = '#0a0e1a';
const PANEL = '#151b2e';
const TEXT_PRIMARY = '#e8e9ed';
const TEXT_SECONDARY = '#9ba1b4';
const TEXT_TERTIARY = '#5e6472';
const BRAND_A = '#4F46E5';
const BRAND_B = '#06B6D4';

const STATUS = {
  live:             { label: 'LIVE',            fill: '#059669' },
  testnet:          { label: 'TESTNET',         fill: '#D97706' },
  'in-progress':    { label: 'IN PROGRESS',     fill: '#7C3AED' },
  'in-development': { label: 'IN DEVELOPMENT',  fill: '#4B5563' },
};

const i18n = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'en.json'), 'utf-8')
);

function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  const s = String(str);
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

// A small neutral GEMBA-mark: circle + crescent "G" — same geometric language
// as /favicon.svg but without any product wordmark. Rendered in the top-left.
function brandMark(x, y, size = 72) {
  const scale = size / 512;
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <defs>
        <linearGradient id="ogBrand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${BRAND_A}"/>
          <stop offset="100%" stop-color="${BRAND_B}"/>
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="220" fill="none" stroke="url(#ogBrand)" stroke-width="12" opacity="0.3"/>
      <circle cx="256" cy="256" r="170" fill="none" stroke="url(#ogBrand)" stroke-width="20"/>
      <path d="M256 130 A126 126 0 1 0 382 256 L300 256"
            fill="none" stroke="url(#ogBrand)" stroke-width="32"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="256" cy="130" r="14" fill="${BRAND_A}"/>
      <circle cx="382" cy="256" r="14" fill="${BRAND_B}"/>
      <circle cx="300" cy="256" r="12" fill="#6366F1"/>
    </g>
  `;
}

function buildSvg({ productName, tagline, url, status }) {
  const st = STATUS[status] || null;
  const mark = brandMark(60, 60, 80);
  const FONT = 'Inter, system-ui, -apple-system, \'Segoe UI\', sans-serif';

  const truncatedTagline = truncate(tagline, 110);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" ry="24"
        fill="${PANEL}" fill-opacity="0.55"
        stroke="${TEXT_TERTIARY}" stroke-opacity="0.22" stroke-width="1"/>

  ${mark}

  <g font-family="${FONT}" font-weight="600" font-size="28" fill="${TEXT_SECONDARY}" letter-spacing="3">
    <text x="160" y="105">GEMBA IT</text>
  </g>
  <line x1="160" y1="124" x2="220" y2="124" stroke="${BRAND_A}" stroke-width="2"/>

  <g font-family="${FONT}" fill="${TEXT_PRIMARY}">
    <text x="88" y="340" font-size="92" font-weight="700" letter-spacing="-1">${escape(productName)}</text>
  </g>

  <g font-family="${FONT}" fill="${TEXT_SECONDARY}">
    <text x="88" y="410" font-size="32" font-weight="400">${escape(truncatedTagline)}</text>
  </g>

  ${st ? `
  <g transform="translate(88, 500)">
    <rect x="0" y="0" width="${20 + st.label.length * 13}" height="44" rx="10" ry="10"
          fill="${st.fill}" fill-opacity="0.18"
          stroke="${st.fill}" stroke-opacity="0.6" stroke-width="1"/>
    <text x="14" y="29" font-family="${FONT}" font-size="20" font-weight="600"
          fill="${st.fill}" letter-spacing="1.5">${escape(st.label)}</text>
  </g>
  ` : ''}

  <g font-family="${FONT}" fill="${TEXT_TERTIARY}" font-size="22" font-weight="400">
    <text x="1112" y="530" text-anchor="end">${escape(url)}</text>
  </g>
</svg>
`;
}

function buildDefaultSvg() {
  const mark = brandMark(60, 60, 80);
  const FONT = 'Inter, system-ui, -apple-system, \'Segoe UI\', sans-serif';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" ry="24"
        fill="${PANEL}" fill-opacity="0.55"
        stroke="${TEXT_TERTIARY}" stroke-opacity="0.22" stroke-width="1"/>

  ${mark}

  <g font-family="${FONT}" font-weight="600" font-size="28" fill="${TEXT_SECONDARY}" letter-spacing="3">
    <text x="160" y="105">GEMBA IT</text>
  </g>
  <line x1="160" y1="124" x2="220" y2="124" stroke="${BRAND_A}" stroke-width="2"/>

  <g font-family="${FONT}" fill="${TEXT_PRIMARY}">
    <text x="88" y="340" font-size="82" font-weight="700" letter-spacing="-1">Technology that works.</text>
  </g>

  <g font-family="${FONT}" fill="${TEXT_SECONDARY}">
    <text x="88" y="410" font-size="30" font-weight="400">Linux, Node.js, React, PostgreSQL, Solidity — built, deployed, maintained.</text>
  </g>

  <g font-family="${FONT}" fill="${TEXT_TERTIARY}" font-size="22" font-weight="400">
    <text x="1112" y="530" text-anchor="end">gembait.com</text>
  </g>
</svg>
`;
}

async function tryLoadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default || mod;
  } catch {
    return null;
  }
}

async function main() {
  const sharp = await tryLoadSharp();
  const writtenSvg = [];
  const writtenPng = [];

  for (const p of products) {
    const tagline = i18n.products?.[p.i18nKey]?.tagline || p.name;
    const urlPath = `gembait.com/en/products/${p.slug}`;
    const svg = buildSvg({
      productName: p.name,
      tagline,
      url: urlPath,
      status: p.status,
    });
    const svgPath = path.join(OUT_DIR, `${p.slug}.svg`);
    fs.writeFileSync(svgPath, svg);
    writtenSvg.push(svgPath);

    if (sharp) {
      const pngPath = path.join(OUT_DIR, `${p.slug}.png`);
      await sharp(Buffer.from(svg)).png().toFile(pngPath);
      writtenPng.push(pngPath);
    }
  }

  // Default
  const defaultSvg = buildDefaultSvg();
  const defaultSvgPath = path.join(OUT_DIR, 'default.svg');
  fs.writeFileSync(defaultSvgPath, defaultSvg);
  writtenSvg.push(defaultSvgPath);
  if (sharp) {
    const defaultPngPath = path.join(OUT_DIR, 'default.png');
    await sharp(Buffer.from(defaultSvg)).png().toFile(defaultPngPath);
    writtenPng.push(defaultPngPath);
  }

  console.log(`SVG: ${writtenSvg.length} files`);
  console.log(`PNG: ${writtenPng.length} files (sharp ${sharp ? 'available' : 'not installed — SVG only'})`);
  console.log(`Out: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
