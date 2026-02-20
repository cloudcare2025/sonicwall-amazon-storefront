#!/bin/sh
set -eu

DIST="dist"

# Clean previous build
rm -rf "$DIST"
mkdir -p "$DIST"
mkdir -p "$DIST/logos"

# Compile TypeScript (outputs script.js alongside script.ts in root)
npx tsc

# Compile SCSS to CSS
npx sass styles.scss "$DIST/styles.css" --style=compressed --no-source-map

# Copy compiled JS
cp script.js "$DIST/"

# Copy static assets
cp index.html "$DIST/"
cp nginx.conf "$DIST/"

# Copy videos if they exist
for f in *.mp4; do
  [ -e "$f" ] && cp "$f" "$DIST/"
done

# Copy logos directory
cp -r logos/* "$DIST/logos/" 2>/dev/null || true

# Copy any other HTML files (proposal, etc.)
for f in *.html; do
  [ "$f" = "index.html" ] && continue
  [ -e "$f" ] && cp "$f" "$DIST/"
done

# Copy PDF files if they exist
for f in *.pdf; do
  [ -e "$f" ] && cp "$f" "$DIST/"
done

echo "Build complete. Output in $DIST/"
