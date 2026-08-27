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
| `FIREBASE_PROJECT_ID` | Projet Firebase (Admin) |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Clé privée service account (`\n` pour les retours ligne) |
| `RESEND_API_KEY` | Clé [Resend](https://resend.com) pour les reports (Aide & contact) |
| `SUPPORT_TO` | Destinataire (défaut `contact@hexald.com`) |
| `ADMIN_EMAILS` | Emails Firebase autorisés pour `/v1/admin/*` (virgules) |

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
| `DELETE` | `/v1/session` | Déconnexion (clear cookie) |
| `POST` | `/v1/session/firebase` | Lie / crée un joueur via idToken Firebase (DEC-024) |
| `POST` | `/v1/session/pseudo` | Claim un pseudo unique (3–20, lettres/chiffres/_) |
| `GET` | `/v1/content` | Catalogue data-driven (`content`) |
| `GET` | `/v1/worlds` | Liste les mondes du joueur courant |
| `POST` | `/v1/worlds` | Crée un monde de départ (owner = session) |
| `GET` | `/v1/worlds/:id` | Charge un monde (owner uniquement) |
| `POST` | `/v1/worlds/:id/actions` | Action unifiée (`build` / `assign_workers` / `generate_region`) |
| `POST` | `/v1/worlds/:id/buildings/destroy` | Démolit un bâtiment (hors village) |
| `GET` | `/v1/admin/overview` | Stats admin (Firebase + `ADMIN_EMAILS`) |

La session est un cookie httpOnly signé. Départ en **invité** ; optionnel : lien Google / email (Firebase) qui conserve le même `playerId` / monde. Les mondes appartiennent au `playerId` de la session.

Mutations monde : `SELECT … FOR UPDATE` (`withWorldLock`) sérialise les écritures concurrentes (multi-onglets / bots). Timeout 3 s → `429 world_busy`.

Build / extracteurs : catalogue `packages/content` (`buildings.placeable`, coûts, durées, rates). Chaînes (`chains`) exposées + helpers craft (`listProcessorRecipes`) — processors pas encore posables.

Renderer : streaming GPU des tuiles biome (`syncBiomeTiles`) — état logique complet en mémoire, meshes chargés/déchargés selon le viewport (hystérésis). Les tuiles vides streamaient déjà.

Admin : [`/admin`](http://127.0.0.1:9089/admin) — connexion Google / email (même auth que le jeu), email dans `ADMIN_EMAILS`.

Économie live : pop + food/croissance (DEC-016–017), extracteurs posés (bois / blé / pierre / **pêche**), inventaire générique, bonus fusion +20&nbsp;% (DEC-019). Banc de poisson (`fish_bank`) + cabane de pêcheur (DEC-021 / 023).

Expansion de région (DEC-020) : coût en **éclats de monde** (`worldshard`) = `hop` (1 voisin, 2 au rang suivant…). Prod hôtel de ville : 1 / 15&nbsp;min, cap 5, départ 1. `409 insufficient_resources` si stock insuffisant. (DEC-015 bois supersédé.)

Comptes (DEC-024) : Firebase Auth côté client + Admin côté API. Configurer `apps/api/.env` et `apps/web/.env` (voir les `.env.example`).

`ads.txt` : [`apps/web/public/ads.txt`](apps/web/public/ads.txt).

## Advertising

Side Rail Ads are managed automatically by Google AdSense on wide desktops. The game shell is centered with a max width (`1400px`) so margins stay available; the app never reserves left/right ad DOM slots in production, and never depends on an ad being shown.

| Mode | Behaviour |
| --- | --- |
| Development | Fake Side Rails (≥1700px) + fake mobile Anchor (≤768px). **No** AdSense script. |
| Production (free) | AdSense script loads when `NUXT_PUBLIC_ADSENSE_CLIENT_ID` is set. Side Rails (desktop) and Anchor ads (mobile) are placed by Google if enabled in the AdSense console. Bottom CTAs keep a modest inset on mobile. |
| Production (No Ads) | No AdSense script, no fake ads ; plein écran (`.game-shell--full`), aucun inset bas. |

Config (see [`apps/web/.env.example`](apps/web/.env.example)):

```text
NUXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
```

`hasNoAds` is centralized in `apps/web/app/composables/useAds.ts`. In dev it can be toggled from the play HUD (**Ads → Free / No Ads**) or the console:

```js
__hexaldAds.setDevNoAds(true)   // No Ads
__hexaldAds.setDevNoAds(false)  // Free user (fake rails)
```

Later, wire `applyEntitlements({ noAds })` from `GET /me` (or equivalent). CMP consent is stubbed as `consentAllowsAds` until the CMP signal is exposed in app code.

On laptop / tablet the shell is full width — no artificial side gaps. On mobile, free users get a small bottom inset for Anchor ads; No Ads clears it.

## Web

```text
pnpm dev:web
```

Écoute `http://127.0.0.1:9089` (et l’IP LAN via `--host`).

| Route | Rôle |
| --- | --- |
| `/` | Landing : pseudo + CTA Jouer (+ connexion Firebase si configuré) |
| `/play` | Écran de jeu (session + pseudo requis) |
| `/news` | Actualités / patch notes joueurs |
| `/privacy`, `/terms`, `/cookies`, `/legals` | Pages légales |
| `/admin` | Stats joueurs / mondes / présence (Firebase + allowlist) |
| `/poc` | Grille hexagonale plein écran (dev) |
| `/backend/**` | Proxy vers l’API Fastify `:9088` |

### Firebase (web)

Copier [`apps/web/.env.example`](apps/web/.env.example) → `apps/web/.env` :

```text
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=
```

Ajouter les domaines autorisés dans Firebase Console (localhost, IP LAN, prod). Desktop = popup Google ; mobile = redirect.

**Docker / VPS** : `apps/web/.env` est gitignored mais doit exister sur le serveur. Il est lu **au build** de l’image web (la landing `/` est pré-rendue avec les boutons Firebase) et au runtime du container. Rebuild obligatoire après création / modification du fichier :

```bash
docker compose --env-file apps/web/.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build web
```

### PWA

Installable via `@vite-pwa/nuxt` (manifest + service worker). **Pas de jeu hors ligne** : l’API (`/backend/**`) est `NetworkOnly`, et un overlay plein écran s’affiche dès que `navigator.onLine` est faux (`OfflineBlocker`).

Le shell est précaché uniquement pour pouvoir afficher ce message à l’ouverture hors ligne. Le SW n’est pas actif en `nuxt dev` (`pwa.devOptions.enabled: false`) — tester via `pnpm --filter @hexald/web build` + `preview` (HTTPS ou localhost).

Icônes : `apps/web/public/icon.png` (fond transparent), `pwa/pwa-192x192.png`, `pwa/pwa-512x512.png`, `pwa/pwa-512x512-maskable.png` (fond menthe pour Android).
