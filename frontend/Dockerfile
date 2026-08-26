# Kunden-Shop (SvelteKit, adapter-node)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# PUBLIC_API_BASE_URL wird zur Build-Zeit eingebettet (SvelteKit $env/static/public).
# Produktion: leer lassen, da Backend über denselben Origin unter /api gemountet wird
# (siehe infra/Caddyfile) -> relative Requests.
ARG PUBLIC_API_BASE_URL=""
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "build"]
