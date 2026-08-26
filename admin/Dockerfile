# Admin-Panel (SvelteKit SPA, adapter-static) — Build-Only-Image.
# Der Output (/app/build, ein statisches Bundle) wird per Volume an Caddy
# übergeben, das ihn direkt ausliefert (kein eigener Node-Prozess nötig).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_API_BASE_URL=""
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
RUN npm run build

FROM alpine:3.20
COPY --from=build /app/build /srv/admin
CMD ["sh", "-c", "cp -r /srv/admin/. /out/ && echo 'Admin-Build nach /out kopiert.'"]
