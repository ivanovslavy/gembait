#!/usr/bin/env node
/**
 * CLI wrapper around imageGenerator.cjs.
 *
 * Used by auto-blog.sh. Keeps the stable shell interface while the underlying
 * module can evolve (Flux.1 dev, retina variants, style guides).
 *
 * Usage (from a site's project root):
 *   set -a && . .env.blog && set +a
 *   node scripts/generate-hero-image.cjs \
 *     --site gembait \
 *     --prompt "Abstract visual concept (no text, no logos)" \
 *     --slug some-post-slug \
 *     [--name hero]            # default 'hero'; pass 'mid' for second image
 *     [--public-root ./public]
 *
 * On success:
 *   stdout JSON:  {"primary":"...","retina":"..."}
 *   exit 0
 *
 * On failure (API down, quota, download error):
 *   stderr error message
 *   exit 1  — caller should set hero:null and hero_status:"needs_image_update"
 */

const path = require('path');
const { generateAndSaveHero } = require('./imageGenerator.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

function die(msg) {
  console.error(`[generate-hero-image] ${msg}`);
  process.exit(1);
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.site) die('--site is required (gembait | gembapay | gembaindustrial)');
  if (!args.prompt) die('--prompt is required');
  if (!args.slug) die('--slug is required');

  const publicRoot = args['public-root']
    ? path.resolve(args['public-root'])
    : path.resolve(process.cwd(), 'public');

  const name = args.name || 'hero';

  console.log(`[generate-hero-image] site=${args.site} slug=${args.slug} name=${name} publicRoot=${publicRoot}`);
  console.log(`[generate-hero-image] concept: ${args.prompt.slice(0, 200)}${args.prompt.length > 200 ? '…' : ''}`);

  const result = await generateAndSaveHero(args.prompt, args.site, args.slug, publicRoot, name);

  if (!result) die('generation failed — see earlier error line');

  console.log(`[generate-hero-image] primary=${result.primary}`);
  console.log(`[generate-hero-image] retina=${result.retina}`);
  // Final machine-readable line on stdout for scripts that grep:
  process.stdout.write(JSON.stringify(result) + '\n');
})();
