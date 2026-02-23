#!/bin/sh
set -eu

DIST="dist"

# Clean previous build
rm -rf "$DIST"
mkdir -p "$DIST"
mkdir -p "$DIST/logos"

# ---------- Compile ----------

# Compile TypeScript -> JavaScript
echo "Compiling TypeScript..."
npx tsc
if [ ! -f script.js ]; then
  echo "ERROR: TypeScript compilation failed -- script.js not found" >&2
  exit 1
fi

# Compile SCSS -> CSS (compressed, no source map for production)
echo "Compiling SCSS..."
npx sass styles.scss "$DIST/styles.css" --style=compressed --no-source-map

# ---------- Minify & Copy assets ----------

# Minify JS with terser
echo "Minifying JavaScript..."
npx terser script.js --compress --mangle --output "$DIST/script.js"

# HTML files
cp index.html "$DIST/"
for f in *.html; do
  [ "$f" = "index.html" ] && continue
  [ -e "$f" ] && cp "$f" "$DIST/"
done

# Minify HTML files
echo "Minifying HTML..."
for f in "$DIST"/*.html; do
  [ -e "$f" ] || continue
  npx html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --remove-redundant-attributes \
    --remove-empty-attributes \
    --minify-css true \
    --minify-js true \
    --output "$f" \
    "$f"
done

# Nginx config (used as template in Docker)
cp nginx.conf "$DIST/"

# Video files
for f in *.mp4; do
  [ -e "$f" ] && cp "$f" "$DIST/"
done

# PDF files
for f in *.pdf; do
  [ -e "$f" ] && cp "$f" "$DIST/"
done

# Logo assets
cp -r logos/* "$DIST/logos/" 2>/dev/null || true

# ---------- Pre-compress for gzip_static ----------
echo "Pre-compressing assets..."
for f in "$DIST"/*.html "$DIST"/*.css "$DIST"/*.js; do
  [ -e "$f" ] || continue
  gzip -9 -k "$f"
done

echo "Build complete. Output in $DIST/"
