# LOT 3 — Économie lisible (HUD / stocks)

**Statut :** `done`  
**DoD :** le joueur ouvre son monde, lit pop/food/bois/éclats/or, ouvre l’économie pour les chaînes, et comprend un processor (input / output / blocage).

## Périmètre

- **Sans** modifier coûts, rates, crafts, pop, food, caps, techs, PC, settle.
- HUD compact (nuages) : pop, nourriture, bois, éclats, or.
- Vue Économie détaillée (progressive disclosure).
- Panneau processor : chaîne + stocks + statut.
- Feedback léger de deltas (pas de faux gain au 1er snapshot).

## Livré

- HUD : stocks numériques sur anneaux ; pierre retirée du bandeau permanent ; éclats + or toujours visibles.
- `PlayEconomyPanel` : chaînes Bois/Planches, Blé/Farine/Food, Pierre, Argile/Briques, Fer, Or, Éclats.
- Progressive disclosure via stock > 0 ou tech/bâtiment lié (pas de table DB).
- Processor I/O dans le bottom sheet ; buffer/valve legacy non affichés.
- Pulse + floaters sur snapshot ; spam offline évité ; `prefers-reduced-motion`.
