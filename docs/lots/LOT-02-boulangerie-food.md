# LOT 2 — Boulangerie → nourriture

**Statut :** done  
**Phase :** 4 · Industry  
**Débloque :** LOT 3+

## Objectif

Fermer :
Ferme → blé → moulin → farine → **boulangerie** → nourriture (`food`)

## Comportement livré

- Boulangerie `placeable: true` — 30 bois, 60 s, 1 artisan, tech Poterie
- Recette : **1 farine → 2 nourriture** / cycle 2 min (`BAKERY_CRAFT_DURATION_MS`)
- Même pipeline processor (settle lazy, influence, PC 12 prod)
- Food craftée crédite `foodSurplusAccumulated` ; settle processors **avant** food/pop
- Mesh 3D + panneau play + wiki + unlock Poterie

## Hors scope (volontaire)

- HUD stocks secondaires (farine bandeau) → LOT 3
- Rééquilibrage économie globale

## Compte rendu (Étape E)

### Réalisé

Chaîne blé → farine → nourriture jouable de bout en bout, y compris offline et croissance.

### Validation

- `node --experimental-strip-types packages/game-core/scripts/bakery-craft-smoke.ts`
- `node --experimental-strip-types packages/game-core/scripts/forge-craft-smoke.ts`

### Prochain lot

**LOT 3 — Économie lisible (HUD / stocks)** — ne pas démarrer ici.
