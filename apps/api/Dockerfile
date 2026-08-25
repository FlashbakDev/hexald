FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/content/package.json ./packages/content/
COPY packages/game-core/package.json ./packages/game-core/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile --filter @hexald/api...

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/content ./packages/content
COPY packages/game-core ./packages/game-core
COPY packages/db ./packages/db

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @hexald/db migrate && pnpm --filter @hexald/api start"]
