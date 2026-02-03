FROM node:22.18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm turbo

FROM base AS prepare
COPY . .
RUN turbo prune web --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml .
RUN pnpm install --no-frozen-lockfile
COPY --from=prepare /app/out/full/ .
WORKDIR /app/apps/web
RUN pnpm build  # Assumes "build": "next build" in package.json

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/next.config.js .
COPY --from=builder /app/apps/web/package.json .
RUN pnpm install --prod --no-frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "start"]  # Assumes "start": "next start" in package.json