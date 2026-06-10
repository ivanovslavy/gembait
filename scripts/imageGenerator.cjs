/**
 * imageGenerator.cjs — Flux.1 [dev] via fal.ai
 *
 * Module used by the blog automation. Exposes:
 *   - generateHeroImage(concept, site)       → image URL (from fal.ai) or null
 *   - downloadAndOptimize(url, outPath)      → { primary, retina } or null
 *   - generateAndSaveHero(concept, site, slug, publicRoot) → { primary, retina } or null
 *
 * Requires FAL_KEY in env (source .env.blog in the caller).
 *
 * The module is intentionally silent-on-success; the caller logs structured
 * lines to the site-specific /var/log/*.log.
 */

const { fal } = require('@fal-ai/client');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

fal.config({
  credentials: process.env.FAL_KEY,
});

const STYLE_GUIDES = {
  gembait: {
    style:
      'Technical illustration, isometric perspective, ' +
      'deep blue and purple color palette with subtle teal accents, ' +
      'minimalist geometric shapes, abstract representation of code and networks, ' +
      'clean modern aesthetic, professional tech branding. ' +
      'No text, no letters, no numbers, no logos, no watermarks.',
    negative:
      'text, letters, words, numbers, logos, watermarks, people, faces, ' +
      'realistic photography, cluttered, neon colors',
  },
  gembapay: {
    style:
      'Financial-technology visualization, gradient from navy blue to emerald green, ' +
      'clean geometric shapes, abstract flow and exchange patterns, ' +
      'modern fintech aesthetic, professional and trustworthy. ' +
      'No text, no letters, no numbers, no logos, no watermarks.',
    negative:
      'text, letters, words, numbers, logos, watermarks, cartoon style, ' +
      'cluttered, dark or menacing, people, faces',
  },
  gembaindustrial: {
    style:
      'Industrial photography style, refinery or petrochemical plant atmosphere, ' +
      'warm industrial lighting, professional documentary feel, technical precision. ' +
      'No text, no logos, no watermarks.',
    negative:
      'text, letters, words, logos, watermarks, cartoon, surreal, fantasy, ' +
      'identifiable faces',
  },
};

/**
 * Call Flux.1 [dev] on fal.ai. Returns the hosted image URL or null on failure.
 * `site` selects the per-brand style guide.
 */
async function generateHeroImage(concept, site) {
  const guide = STYLE_GUIDES[site];
  if (!guide) throw new Error(`Unknown site: ${site}`);
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY missing in env (source .env.blog first)');

  const fullPrompt = `${guide.style} ${concept}`.trim();

  try {
    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt: fullPrompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: false,
    });
    const url = result?.data?.images?.[0]?.url;
    if (!url) {
      console.error('[imageGen] fal.ai response missing images[0].url');
      return null;
    }
    return url;
  } catch (err) {
    console.error(`[imageGen] fal.ai error: ${err.message}`);
    return null;
  }
}

/**
 * Download the Flux output and produce two WebP files:
 *   outPath         — 1200x630
 *   outPath@2x.webp — 2400x1260
 *
 * outPath must end in ".webp". Returns { primary, retina } or null on failure.
 */
async function downloadAndOptimize(imageUrl, outPath) {
  if (!outPath.endsWith('.webp')) {
    throw new Error(`outPath must end in .webp, got ${outPath}`);
  }
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    await fs.mkdir(path.dirname(outPath), { recursive: true });

    await sharp(buffer)
      .resize(1200, 630, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(outPath);

    const retinaPath = outPath.replace(/\.webp$/, '@2x.webp');
    await sharp(buffer)
      .resize(2400, 1260, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(retinaPath);

    return { primary: outPath, retina: retinaPath };
  } catch (err) {
    console.error(`[imageGen] download/optimize error: ${err.message}`);
    return null;
  }
}

/**
 * Convenience wrapper used by auto-blog flows.
 *
 * Writes to  <publicRoot>/images/blog/<slug>/<name>.webp  (+ @2x).
 * `name` defaults to 'hero' for backwards compatibility; pass 'mid' for the
 * mid-article second image (per the 2-image blog layout).
 *
 * Returns the two paths or null if generation failed.
 *
 * If fal.ai fails, the caller should fall back to
 *   <publicRoot>/images/blog/fallbacks/<site>-default.webp
 * and mark the post with hero_status: "needs_image_update" in posts.json.
 */
async function generateAndSaveHero(concept, site, slug, publicRoot, name = 'hero') {
  if (!publicRoot) throw new Error('generateAndSaveHero: publicRoot is required');
  if (!/^[a-z][a-z0-9_-]*$/i.test(name)) {
    throw new Error(`generateAndSaveHero: invalid name "${name}" — must match [A-Za-z][A-Za-z0-9_-]*`);
  }
  const url = await generateHeroImage(concept, site);
  if (!url) return null;

  const outDir = path.join(publicRoot, 'images', 'blog', slug);
  const outPath = path.join(outDir, `${name}.webp`);
  return await downloadAndOptimize(url, outPath);
}

module.exports = {
  STYLE_GUIDES,
  generateHeroImage,
  downloadAndOptimize,
  generateAndSaveHero,
};
