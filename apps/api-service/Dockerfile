FROM node:22.18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm turbo

FROM base AS prepare
COPY . .
RUN turbo prune api-service --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml .
RUN pnpm install --no-frozen-lockfile
COPY --from=prepare /app/out/full/ .
WORKDIR /app/packages/prisma
RUN npx prisma generate
RUN npx tsc -b
WORKDIR /app/apps/api-service
RUN npx tsc -b

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/api-service/dist/ .
EXPOSE 3001
CMD [ "node","dist/index.js" ]