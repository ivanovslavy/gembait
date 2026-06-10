#!/usr/bin/env node
/**
 * Minimal JSON-LD schema validator for blog sidecars.
 *
 * Usage:
 *   node scripts/validate-schema.cjs content/blog/<slug>.schema.json
 *
 * Checks the two required shapes:
 *   { articleSchema: { @type: TechArticle|Article, ... }, faqSchema: { @type: FAQPage, ... } }
 *
 * Validation rules (derived from Google's TechArticle / Article / FAQPage
 * structured-data reference docs):
 *   - @context MUST be "https://schema.org"
 *   - articleSchema required fields: @type, headline, datePublished, author, publisher
 *   - author + publisher must have @type and name
 *   - faqSchema required: @type=FAQPage, mainEntity: array of {Question, acceptedAnswer}
 *   - each Question: @type=Question, name, acceptedAnswer.@type=Answer, acceptedAnswer.text
 *
 * Exits 0 on valid, 1 on invalid (with reasons on stderr).
 */

const fs = require('fs');

function fail(msg) {
  console.error(`[validate-schema] FAIL: ${msg}`);
  process.exitCode = 1;
}

function requireField(obj, field, path) {
  if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
    fail(`${path}.${field} is required`);
    return false;
  }
  return true;
}

function validateArticle(schema) {
  const path = 'articleSchema';
  if (schema['@context'] !== 'https://schema.org') fail(`${path}.@context must be "https://schema.org"`);
  const t = schema['@type'];
  if (!['TechArticle', 'Article', 'NewsArticle'].includes(t))
    fail(`${path}.@type must be TechArticle, Article or NewsArticle (got ${t})`);

  requireField(schema, 'headline', path);
  requireField(schema, 'datePublished', path);
  requireField(schema, 'dateModified', path);
  requireField(schema, 'description', path);
  requireField(schema, 'image', path);

  if (requireField(schema, 'author', path)) {
    const a = schema.author;
    if (!a['@type']) fail(`${path}.author.@type required`);
    if (!a.name) fail(`${path}.author.name required`);
  }
  if (requireField(schema, 'publisher', path)) {
    const p = schema.publisher;
    if (p['@type'] !== 'Organization') fail(`${path}.publisher.@type must be Organization`);
    if (!p.name) fail(`${path}.publisher.name required`);
    if (!p.logo || !p.logo.url) fail(`${path}.publisher.logo.url required`);
  }

  // TechArticle-specific
  if (t === 'TechArticle') {
    if (schema.proficiencyLevel && !['Beginner', 'Expert'].includes(schema.proficiencyLevel))
      fail(`${path}.proficiencyLevel must be "Beginner" or "Expert" if present`);
  }
}

function validateFaq(schema) {
  const path = 'faqSchema';
  if (schema['@context'] !== 'https://schema.org') fail(`${path}.@context must be "https://schema.org"`);
  if (schema['@type'] !== 'FAQPage') fail(`${path}.@type must be FAQPage`);

  if (!Array.isArray(schema.mainEntity) || schema.mainEntity.length < 1)
    return fail(`${path}.mainEntity must be non-empty array`);

  schema.mainEntity.forEach((q, i) => {
    const qPath = `${path}.mainEntity[${i}]`;
    if (q['@type'] !== 'Question') fail(`${qPath}.@type must be Question`);
    if (!q.name) fail(`${qPath}.name required`);
    const a = q.acceptedAnswer;
    if (!a) return fail(`${qPath}.acceptedAnswer required`);
    if (a['@type'] !== 'Answer') fail(`${qPath}.acceptedAnswer.@type must be Answer`);
    if (!a.text) fail(`${qPath}.acceptedAnswer.text required`);
  });
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-schema.cjs <path/to/slug.schema.json>');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Invalid JSON: ${e.message}`);
  process.exit(1);
}

if (!data.articleSchema) fail('top-level.articleSchema required');
else validateArticle(data.articleSchema);

if (!data.faqSchema) fail('top-level.faqSchema required');
else validateFaq(data.faqSchema);

if (process.exitCode) {
  console.error(`[validate-schema] ${file} is INVALID`);
  process.exit(process.exitCode);
}
console.log(`[validate-schema] ${file} OK`);
