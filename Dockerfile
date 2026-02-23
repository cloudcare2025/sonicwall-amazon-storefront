# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first (best layer caching -- only re-runs when deps change)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy build config and source code (changes frequently, but small)
COPY tsconfig.json ./
COPY build.sh ./
COPY script.ts ./
COPY styles.scss ./
COPY index.html ./
COPY nginx.conf ./

# Copy additional HTML and PDF files
COPY *.html ./
COPY *.pdf ./

# Copy static assets
COPY logos/ ./logos/

# Copy video files last (largest files, least likely to change)
COPY *.mp4 ./

# Run build
RUN chmod +x build.sh && sh build.sh

# Stage 2: Serve with minimal image
FROM nginx:stable-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx config as template (Railway injects $PORT at runtime via envsubst)
COPY --from=build /app/dist/nginx.conf /etc/nginx/templates/default.conf.template

# Non-root healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-80}/ || exit 1

ENV PORT=80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
