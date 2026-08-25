# Hexald

Jeu de gestion / stratégie persistant par navigateur. Chaque joueur crée progressivement son propre monde.

Ce dépôt est un monorepo. L’API Fastify et le client Nuxt sont initialisés.

## Ouvrir le Project Hub

Documentation et suivi du projet (site statique, sans build) :

```text
docs/index.html
```

## Structure

```text
hexald/
├── apps/
│   ├── web/              Client — Nuxt 4, Vue, Three.js
│   └── api/              Serveur — Fastify, autoritaire
├── packages/
│   ├── shared/           Types et contrats client / serveur
│   ├── game-core/        Règles du jeu, validation, production hors ligne
│   ├── content/          Biomes, ressources, bâtiments, recettes
│   └── db/               Schéma Drizzle + accès PostgreSQL
├── docs/                 Project Hub (HTML/CSS/JS)
├── docker-compose.yml    PostgreSQL local
├── package.json
└── pnpm-workspace.yaml
```

`docs/` n’est pas un workspace npm : c’est un site à ouvrir directement.

## Packages

| Package | Rôle |
| --- | --- |
| `@hexald/web` | UI, pages, menus, inventaire. Three.js uniquement pour la carte. |
| `@hexald/api` | API Fastify. Valide chaque action. |
| `@hexald/shared` | Types partagés, payloads. |
| `@hexald/game-core` | Règles, indépendantes de l’UI et du rendu. |
| `@hexald/content` | Données : biomes, bâtiments, recettes, coûts. |
| `@hexald/db` | Schéma Drizzle, migrations, accès PostgreSQL. |

Les apps dépendent des packages via `workspace:*`.

## Base de données

```text
pnpm db:up
pnpm db:migrate
```

PostgreSQL écoute sur `127.0.0.1:5432` (user/db/password : `hexald`).

Copier [`apps/api/.env.example`](apps/api/.env.example) vers `apps/api/.env` si besoin.

Variables utiles dans `.env` :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL |
| `SESSION_SECRET` | Secret de signature du cookie anonyme (`tw_sid`, min. 32 caractères) |
| `CORS_ORIGINS` | Origines autorisées (credentials), séparées par des virgules |

| Script | Rôle |
| --- | --- |
| `pnpm db:up` | Démarre Postgres (Docker Compose) |
| `pnpm db:down` | Arrête Postgres |
| `pnpm db:generate` | Génère une migration Drizzle |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:studio` | Ouvre Drizzle Studio |

## API

```text
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev:api
```

Écoute sur tout le réseau local (`--host` → `0.0.0.0:9088`).

- Local : `http://127.0.0.1:9088`
- LAN : `http://<ip-du-pc>:9088`

Pour rester en localhost uniquement : `pnpm --filter @hexald/api dev -- --host 127.0.0.1`

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/health` | Santé du process (+ ping DB) |
| `POST` | `/v1/session` | Crée / renouvelle la session anonyme (cookie `tw_sid`) |
| `GET` | `/v1/session` | Session courante (`401` si absente) |
| `POST` | `/v1/session/pseudo` | Claim un pseudo unique (3–20, lettres/chiffres/_) |
| `GET` | `/v1/content` | Catalogue data-driven (`content`) |
| `GET` | `/v1/worlds` | Liste les mondes du joueur courant |
| `POST` | `/v1/worlds` | Crée un monde de départ (owner = session) |
| `GET` | `/v1/worlds/:id` | Charge un monde (owner uniquement) |
| `POST` | `/v1/actions` | Action joueur → `game-core` (session requise) |
| `GET` | `/v1/admin/overview` | Stats admin (sans auth pour l’instant) |
| `POST` | `/v1/worlds/:id/workers` | Assigne des travailleurs extracteurs |
| `POST` | `/v1/worlds/:id/buildings` | Pose un extracteur sur une tuile |

La session anonyme est un cookie httpOnly signé. Les mondes appartiennent au `playerId` de la session.

UI admin (dev) : [`/admin`](http://127.0.0.1:9089/admin).

Économie v0 : pop fixe 8, extracteurs **posés** sur la carte (max 1 chacun), prod lazy offline.

Expansion de région (DEC-015) : coût bois `30 × hop` (distance au village), remise −20 % / bâtiment à d=1, −5 % à d=2 (cap 50 %). `409` si stock insuffisant.

`ads.txt` : [`apps/web/public/ads.txt`](apps/web/public/ads.txt).

## Web

```text
pnpm dev:web
```

Écoute `http://127.0.0.1:9089` (et l’IP LAN via `--host`).

| Route | Rôle |
| --- | --- |
| `/` | Landing : pseudo + CTA Jouer |
| `/play` | Écran de jeu (session + pseudo requis) |
| `/admin` | Stats joueurs / mondes / présence (sans auth) |
| `/poc` | Grille hexagonale plein écran (dev) |
| `/backend/**` | Proxy vers l’API Fastify `:9088` |
