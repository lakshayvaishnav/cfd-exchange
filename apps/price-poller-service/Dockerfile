FROM node:22.18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm turbo

FROM base AS prepare
COPY . .
RUN turbo prune price-poller-service --docker

FROM base as builder
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml .
RUN pnpm install --no-frozen-lockfile
COPY --from=prepare /app/out/full .
WORKDIR /app/apps/price-poller-service
RUN npx tsc -b

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/price-poller-service/dist/ .
EXPOSE 3003
CMD [ "node", "dist/index.js" ]

