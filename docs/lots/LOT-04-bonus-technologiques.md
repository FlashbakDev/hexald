# LOT 4 — Bonus technologiques fiables + visibles

**Statut :** `done`  
**DoD :** aucune tech ne prétend offrir un bonus sans effet réel ou invisible ; breakdown base + tech + fusion lisible sur le panneau bâtiment.

## Périmètre

- Auditer pâturage, plantation/ferme, lumber, carrière+maçonnerie, mine+maçonnerie.
- Application serveur réelle (déjà en place) + pas de doublons fusion×tech.
- Affichage UI du breakdown (base + tech + fusion).
- Smoke tests ciblés.
- **Sans** inventaire d’objets, niveaux de bâtiments, autres passives catalogue.

## Livré

- Audit : settle déjà correct (flats tech après fusion × workers×base).
- `extractorSiteRateBreakdown` + `techFoodBonusBreakdown` / `techFoodBonusPerMinute` exportés (`packages/game-core`).
- Building sheet : Production totale + sous-ligne `base · fusion · tech` (lumber / carrière / mine / fusion seule).
- Hints food tech : village (pâturage + plantation) ; ferme (`+N nourriture / min (plantation)`).
- Live rates HUD alignés sites influencés + complete.
- Smoke : `packages/game-core/scripts/tech-bonus-smoke.ts`.

## Prochain lot

**LOT 5 — Feedback & game feel** (`ready`) — ne pas démarrer ici.
