#!/bin/bash
# ============================================================
# Blog Publish Script for gembait.com
# Run after adding a new blog post:
#   ./publish-blog.sh
# ============================================================

set -e

SITE_DIR="/gembait.com"

echo "=== Publishing Blog Updates ==="

# 1. Regenerate sitemap
echo ">>> Generating sitemap..."
cd "$SITE_DIR"
node generate-sitemap.mjs

# 2. Build
echo ">>> Building site..."
npm run build

# 3. Copy static SEO files to dist (in case build overwrites)
echo ">>> Copying SEO files..."
cp -f public/robots.txt dist/ 2>/dev/null || true
cp -f public/sitemap.xml dist/ 2>/dev/null || true
cp -f public/llms.txt dist/ 2>/dev/null || true
cp -f public/llms-full.txt dist/ 2>/dev/null || true

# 4. Reload Apache
echo ">>> Reloading Apache..."
sudo systemctl reload apache2

echo ""
echo "=== Blog Published Successfully ==="
echo "Visit: https://gembait.com/en/blog"
