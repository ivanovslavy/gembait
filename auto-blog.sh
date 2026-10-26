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

TOPIC_HINT="${1:-}"   # по желание: тема от оператора

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
# 🔑 От 26.10.2026 писачът върви през Claude Agent SDK, а НЕ през Claude Code.
#    Причината: SDK се удостоверява САМО с ANTHROPIC_API_KEY (няма връщане към
#    абонаментната OAuth сесия), затова харчи ПРОМОЦИОНАЛНИТЕ кредити, а не купените,
#    и отпада режимът на провал „тих OAuth logout“ от 03.08.2026.
#    Брифът живее в /opt/blog-agent/briefs/gembait.md — там се редактира, не тук.
/usr/bin/node /opt/blog-agent/run.mjs gembait "$TOPIC_HINT"
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
