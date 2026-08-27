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

# Public client config — also overridable via build-args / apps/web/.env.
# Required at *build* time because `/` is prerendered (Firebase buttons gated on config).
ARG NUXT_PUBLIC_FIREBASE_API_KEY=
ARG NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NUXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NUXT_PUBLIC_FIREBASE_APP_ID=
ARG NUXT_PUBLIC_SITE_URL=
ARG NUXT_PUBLIC_ADSENSE_CLIENT_ID=
ENV NUXT_PUBLIC_FIREBASE_API_KEY=$NUXT_PUBLIC_FIREBASE_API_KEY \
    NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NUXT_PUBLIC_FIREBASE_PROJECT_ID=$NUXT_PUBLIC_FIREBASE_PROJECT_ID \
    NUXT_PUBLIC_FIREBASE_APP_ID=$NUXT_PUBLIC_FIREBASE_APP_ID \
    NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL \
    NUXT_PUBLIC_ADSENSE_CLIENT_ID=$NUXT_PUBLIC_ADSENSE_CLIENT_ID

# Load apps/web/.env from the build context when present (VPS).
# Needed at build time: `/` is prerendered and gates Firebase CTAs on public config.
RUN set -a \
  && if [ -f apps/web/.env ]; then . ./apps/web/.env; fi \
  && set +a \
  && pnpm --filter @hexald/web build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9089

COPY --from=build /app/apps/web/.output ./.output

EXPOSE 9089

CMD ["node", ".output/server/index.mjs"]
