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

# ---------- Copy assets ----------

# Compiled JS
cp script.js "$DIST/"

# HTML files
cp index.html "$DIST/"
for f in *.html; do
  [ "$f" = "index.html" ] && continue
  [ -e "$f" ] && cp "$f" "$DIST/"
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

echo "Build complete. Output in $DIST/"
