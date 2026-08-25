FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/content/package.json ./packages/content/
COPY packages/game-core/package.json ./packages/game-core/

RUN pnpm install --frozen-lockfile --filter @hexald/web...

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY packages/content ./packages/content
COPY packages/game-core ./packages/game-core

# Proxy Nitro → service Compose `api` (réseau Docker interne)
ARG NUXT_API_PROXY_TARGET=http://api:9088
ENV NUXT_API_PROXY_TARGET=$NUXT_API_PROXY_TARGET

RUN pnpm --filter @hexald/web build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9089

COPY --from=build /app/apps/web/.output ./.output

EXPOSE 9089

CMD ["node", ".output/server/index.mjs"]
