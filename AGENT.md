# Hexald

## Comment c'est rangé

- `apps/` — applications (web Nuxt, api Fastify)
- `packages/` — shared, game-core, content, db
- `docs/` — Project Hub + plan d’exécution des lots
- `.cursor/rules/` — règles agent (priorités, archi, workflow lots)

## Les commandes

- `pnpm db:up`
- `pnpm db:migrate`
- `pnpm dev:api`
- `pnpm dev:web`

## Les règles

- Plan lots : `docs/lots/EXECUTION-PLAN.md` — suivi : `docs/lots/STATUS.md`
- Design / DEC : `docs/index.html` (prochain DEC-028)
- Un seul lot à la fois ; feature incomplète > feature nouvelle
- Logique autoritaire dans `game-core` + `apps/api`, pas dans le client
