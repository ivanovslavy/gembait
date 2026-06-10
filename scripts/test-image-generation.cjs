#!/usr/bin/env node
/**
 * Smoke test for imageGenerator.cjs.
 *
 * Usage (from any of the 3 site roots):
 *   set -a && . .env.blog && set +a
 *   node scripts/test-image-generation.cjs [site]
 *
 * Defaults to site=gembait. Writes to /tmp/imagegen-test/<slug>/hero.webp (+ @2x).
 * Prints paths on success, exits 1 on failure.
 */

const path = require('path');
const { generateAndSaveHero } = require('./imageGenerator.cjs');

const CONCEPTS = {
  gembait:
    'A smart-contract reentrancy bug visualized as a recursive loop trapped ' +
    'inside an isometric glass container, blue and purple gradient, clean abstract.',
  gembapay:
    'Two parallel stablecoin flows converging on a single settlement channel, ' +
    'one flow delayed by one block — abstract gradient blue-to-green, geometric.',
  gembaindustrial:
    'A reactor vessel seen from the access platform at night, warm industrial ' +
    'lighting, cables and scaffolding, documentary style, no people.',
};

(async () => {
  const site = (process.argv[2] || 'gembait').toLowerCase();
  const concept = CONCEPTS[site];
  if (!concept) {
    console.error(`Unknown site: ${site}. Valid: ${Object.keys(CONCEPTS).join(', ')}`);
    process.exit(2);
  }

  const publicRoot = '/tmp/imagegen-test';
  const slug = `test-${site}-${Date.now()}`;

  console.log(`[test] site=${site} slug=${slug}`);
  console.log(`[test] concept: ${concept}`);

  const result = await generateAndSaveHero(concept, site, slug, publicRoot);
  if (!result) {
    console.error('[test] FAILED — see earlier error');
    process.exit(1);
  }
  console.log('[test] SUCCESS');
  console.log(`[test] primary: ${result.primary}`);
  console.log(`[test] retina:  ${result.retina}`);
})();
