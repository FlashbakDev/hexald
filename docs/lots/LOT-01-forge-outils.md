# LOT 1 — Forge → outils

**Statut :** done  
**Phase :** 4 · Industry  
**Bloque :** LOT 2+

## Objectif

Fermer la boucle :

Mine de fer → minerai → fonderie → lingot → **forge** → outils

## Comportement livré

- Forge `placeable: true` — 40 bois, 60 s, 1 artisan, tech Métallurgie
- Recette : **5 lingots → 1 outil** / cycle 2 min (`FORGE_CRAFT_DURATION_MS`)
- Même pipeline processor que la fonderie (settle lazy, buffers, influence, PC 12 prod)
- Mesh 3D + panneau play (hints bloqués / barre craft / stock outils)
- Wiki + hub docs mis à jour

## Hors scope (volontaire)

- Affichage outils dans le bandeau HUD global → LOT 3
- Boulangerie → LOT 2

## Compte rendu (Étape E)

### Réalisé

Chaîne fer complète jusqu’aux outils ; forge posable, craft offline, UI compréhensible.

### Fichiers importants

- `packages/content` — buildings, recipes, economy (`FORGE_CRAFT_DURATION_MS`)
- `packages/shared` — `PlaceableBuildingId`
- `packages/game-core` — `processorCraft.ts` + smoke `scripts/forge-craft-smoke.ts`
- `apps/web` — `createForgeMesh.ts`, `createHexScene.ts`, `play.vue`, wiki forge
- `docs/index.html` + `docs/lots/*`

### Validation

- `node --experimental-strip-types packages/game-core/scripts/forge-craft-smoke.ts` → **ok**
- `pnpm --filter @hexald/web build` → client Nuxt **ok** (warnings CSS/link preexistants) ; Nitro server build lancé ensuite

### Points restants non bloquants

- Outils pas encore dans le bandeau stocks (LOT 3)
- Pas d’usage gameplay des outils (sink) — hors lot

### Prochain lot

**LOT 2 — Boulangerie → nourriture** (ne pas démarrer tant que ce CR n’est pas accepté / lot 1 validé côté produit).
