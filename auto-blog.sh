#!/bin/bash
# ============================================================
# Automated blog writer for gembait.com (GEMBA IT)
# 2026 community-problem SEO strategy: one retold developer problem per week.
#   crontab: 0 9 * * 1  /gembait.com/auto-blog.sh >> /var/log/gembait-blog.log 2>&1
# ============================================================

set -e

SITE_DIR="/gembait.com"
BLOG_DIR="$SITE_DIR/content/blog"
LOG_PREFIX="[AUTO-BLOG-IT $(date '+%Y-%m-%d %H:%M')]"

echo "$LOG_PREFIX Starting..."

# Failure alert (owner-approved 2026-07-05): email Slavy if this run exits non-zero
# (auth error, crash, skipped week). Sender: /home/slavy/bin/blog-alert.cjs.
trap 'rc=$?; if [ "$rc" -ne 0 ]; then /usr/bin/node /home/slavy/bin/blog-alert.cjs "gembait.com" "exit=$rc; $(tail -c 900 /var/log/gembait-blog.log 2>/dev/null)" || true; fi' EXIT
cd "$SITE_DIR"

# Load FAL_KEY (and future API keys) into env for the image helper
if [ -f "$SITE_DIR/.env.blog" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SITE_DIR/.env.blog"
  set +a
else
  echo "$LOG_PREFIX WARNING: $SITE_DIR/.env.blog missing, hero-image generation will fail"
fi

# shellcheck disable=SC2016
/home/slavy/.local/bin/claude -p --dangerously-skip-permissions "$(cat <<'PROMPT'
You are the autonomous weekly blog writer for gembait.com.

Read these files first (strict order, all of them):
  1. /gembait.com/content/blog/CLAUDE.md            (full strategy, voice, forbidden vocabulary)
  2. /gembait.com/content/blog/story_vault.md       (first-hand stories you may integrate)
  3. /gembait.com/content/blog/posts.json           (what has been published)

Your job TODAY: publish ONE new English post following the 7-step process
in CLAUDE.md. Summary of steps (read CLAUDE.md for the full detail):

  1. DISCOVERY -- use WebSearch to find 5-8 candidate problems from the last
     30 days across the allowed sources for this site's 3 clusters:
       - Stack Overflow tags: solidity, ethereum, web3, ethers.js, hardhat,
         viem, node.js, postgresql, webhook, stripe-connect, paypal-rest-sdk
       - GitHub Issues: ethereum/solidity, OpenZeppelin/openzeppelin-contracts,
         NomicFoundation/hardhat, ethers-io/ethers.js, wevm/viem,
         stripe/stripe-node, paypal/Checkout-NodeJS-SDK, nodejs/node,
         expressjs/express
       - Reddit: r/ethdev, r/solidity, r/webdev, r/node
       - dev.to (100+ reactions, for topic popularity reference only)
     Enforce rotation rules from CLAUDE.md by reading posts.json:
       - never 2 consecutive posts from the same source_type
       - never 3 consecutive posts from the same cluster
       - every 5th post is a pillar (2500+ words) covering a whole problem class
     Pick ONE candidate that is specific, non-trivial, has a quality solution
     in the discussion, and is emotionally relatable.

  2. RESEARCH DEPTH -- use WebFetch on the original thread URL. Read the full
     question, top 3 answers, nuance in comments, any duplicate/related links.
     Also pull the official documentation page that covers the underlying
     primitive (you will cite it as the authoritative external link).

  3. EMOTIONAL ANGLE -- pick ONE hook category from CLAUDE.md
     ("docs_lie", "hidden_trap", etc.) and write it as a single sentence at
     the top of your draft notes.

  4. WRITE -- 1500-2200 words, following the 7-section recipe in CLAUDE.md
     (Opening, Problem, Debugging Dance, Solution, Lesson, Credit, FAQ).
     Target a long-tail H1 (3-6 words). Write the EN post first; translations
     come in step 8b.

  5. SELF-REVIEW -- grep your draft for every banned phrase in CLAUDE.md's
     Forbidden Vocabulary list. On any hit, rewrite that paragraph.
     Honesty check: byline MUST be "GEMBA IT team" unless a story from
     story_vault.md is integrated, in which case "Slavcho Ivanov and the
     GEMBA IT team" and first_hand_story_used=true in posts.json.

  6. HERO IMAGE (two-step, Flux.1 [dev]):
     a) From the finalized title + opening paragraph, compose a short visual
        concept (1-2 sentences). Rules: abstract central metaphor, NO people
        or faces, NO readable text or numbers in the image, NO brand logos.
        Think "isometric technical illustration", not "literal scene".
     b) Run:
         node /gembait.com/scripts/generate-hero-image.cjs \
           --site gembait \
           --slug <post-slug> \
           --prompt "<concept from step a>" \
           --public-root /gembait.com/public
        On success, add to frontmatter:
           hero: /images/blog/<slug>/hero.webp
           heroRetina: /images/blog/<slug>/hero@2x.webp
        And to posts.json: hero_status: "generated"
     c) If the CLI exits non-zero, fall back to the brand default:
           hero: /images/blog/fallbacks/gembait-default.webp
           heroRetina: /images/blog/fallbacks/gembait-default@2x.webp
        And posts.json: hero_status: "fallback"
        Continue publishing -- image failure is NEVER a blocker.
        Log "FAILED to generate image for <slug>: <reason>" to stderr.

  7. STRUCTURED DATA SIDECAR (mandatory):
     Write /gembait.com/content/blog/<slug>.schema.json with the
     articleSchema (TechArticle for Cluster 1/2, Article for Cluster 3) +
     faqSchema (FAQPage) objects. See CLAUDE.md "Structured data" section
     for the full shape.
     Validate:
         node /gembait.com/scripts/validate-schema.cjs \
           /gembait.com/content/blog/<slug>.schema.json
     If validation fails, FIX the sidecar before proceeding. DO NOT
     publish with an invalid schema -- Google's rich results will reject it.


  8b. TRANSLATIONS (mandatory, owner rule 2026-07-05): after the EN post is
     final, write FULL Bulgarian and Spanish translations as
     /gembait.com/content/blog/<slug>.bg.md and <slug>.es.md — body-only
     (NO frontmatter), starting with the translated H1. Translate image alt
     text and Mermaid labels; keep code, commands and URLs as-is. In the
     posts.json entry, make title and excerpt objects with en/bg/es keys.

  8. PUBLISH:
         cd /gembait.com
         node generate-sitemap.mjs
         npm run build
         sudo systemctl restart gembait

     Save the post as /gembait.com/content/blog/<slug>.en.md. Prepend the
     extended posts.json entry (see schema in CLAUDE.md: source_url,
     source_type, source_date, emotional_hook, word_count,
     first_hand_story_used, hero_status).

FAILURE MODES (explicit, follow these):
  - No quality candidate today: do NOT publish a filler post. Log
    "NO_QUALITY_CANDIDATE: <3-line reason>" to stderr and exit non-zero.
  - WebSearch returns empty: try alternative queries (broader tags,
    different time windows) before abandoning.
  - Original thread paywalled / dead: pick a different candidate.
  - Fal.ai quota exceeded / errors: publish with hero:null and flag in
    posts.json; do not block on image.

TODAY'S DATE: set it from `date -I` at the start, use that in frontmatter
`date:` and `lastUpdated:`.

Never modify files outside /gembait.com/content/blog/ and
/gembait.com/public/blog/. Never sign
"Slavcho Ivanov" on a post without a matching story_vault.md entry.
PROMPT
)" \
  --allowedTools "Read,Write,Edit,Bash,Glob,Grep,WebSearch,WebFetch" \
  --max-turns 100

echo "$LOG_PREFIX Done."

# Auto commit+push of new blog content (owner rule 2026-07-05).
# No-op if /gembait.com is not a git repo. Secret-scans staged diff; emails on push failure.
(
  cd /gembait.com || exit 0
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
  git add content/blog public/images/blog public/sitemap.xml >/dev/null 2>&1 || true
  git diff --cached --quiet && exit 0
  if git diff --cached | grep -qiE "sk_live_|api[_-]?key *=|BEGIN (RSA |EC )?PRIVATE KEY|passwd|password *="; then
    echo "[auto-blog] SECRET SUSPECT in staged diff - NOT committing" >&2
    /usr/bin/node /home/slavy/bin/blog-alert.cjs "gembait.com" "auto-commit skipped: secret suspect in staged blog diff - review manually" || true
    exit 0
  fi
  git commit -q -m "blog: weekly auto-post $(date -I)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" || exit 0
  if git push -q origin main; then
    echo "[auto-blog] blog content committed + pushed"
  else
    echo "[auto-blog] git push FAILED" >&2
    /usr/bin/node /home/slavy/bin/blog-alert.cjs "gembait.com" "weekly post published OK but git push FAILED - push manually from /gembait.com" || true
  fi
) || true
