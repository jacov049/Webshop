# Backend-API (Node.js/Express)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY src/db/schema.sql ./dist/db/schema.sql
RUN mkdir -p uploads/products && addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
