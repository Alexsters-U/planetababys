FROM node:22-alpine AS dependencies
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
FROM dependencies AS builder
COPY backend ./backend
COPY src/shared/validation.ts ./src/shared/validation.ts
COPY src/shared/validation-messages.ts ./src/shared/validation-messages.ts
COPY src/shared/promotions.ts ./src/shared/promotions.ts
COPY src/shared/analytics.ts ./src/shared/analytics.ts
COPY src/shared/store-profile.ts ./src/shared/store-profile.ts
COPY src/shared/store-sales.ts ./src/shared/store-sales.ts
COPY src/shared/proxy-context.ts ./src/shared/proxy-context.ts
COPY scripts ./scripts
RUN pnpm build:api && pnpm --filter @planetababys/api deploy --legacy --prod /out
RUN for destination in /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client; do cp -R node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/. "$destination"; done
FROM dependencies AS tools
COPY prisma ./prisma
COPY src/shared/brand/catalog-images.json ./src/shared/brand/catalog-images.json
COPY scripts ./scripts
CMD ["pnpm","db:migrate"]
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app && mkdir -p /app/uploads && chown app:app /app/uploads
ENV NODE_ENV=production API_PORT=4000 UPLOAD_DIR=/app/uploads
COPY --from=builder --chown=app:app /out ./
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -q --spider http://127.0.0.1:4000/api/health || exit 1
CMD ["node","dist/server.cjs"]
