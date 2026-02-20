# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source files
COPY tsconfig.json ./
COPY script.ts ./
COPY build.sh ./
COPY index.html styles.css styles.scss nginx.conf ./
COPY *.mp4 ./
COPY logos/ ./logos/
COPY *.html ./
COPY *.pdf ./

# Run build (compiles TS + copies assets to dist/)
RUN chmod +x build.sh && sh build.sh

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY --from=build /app/dist/nginx.conf /etc/nginx/templates/default.conf.template
ENV PORT=80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
