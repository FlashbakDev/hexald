# Lots — suivi opérationnel

**Lot courant :** LOT 3 — Économie lisible (HUD / stocks)  
**Statut :** `done`  
**Plan maître :** [`EXECUTION-PLAN.md`](./EXECUTION-PLAN.md)

| Lot | Titre | Statut |
| --- | --- | --- |
| 1 | Chaîne fer → outils (Forge) | done |
| 2 | Chaîne blé → nourriture (Boulangerie) | done |
| 3 | Économie lisible (HUD / stocks) | done |
| 4 | Bonus technologiques fiables + visibles | ready |
| 5 | Feedback & game feel | blocked |
| 6 | Parcours 20 premières minutes | blocked |
| 7 | Équilibrage boucle principale | blocked |
| 8 | Polish visuel du diorama | blocked |
| 9 | Objectifs & rétention légère | blocked |
| 10 | Adjacences stratégiques | blocked |

Statuts autorisés : `ready` · `in_progress` · `done` · `blocked`.

## Règles de bascule

1. Un seul lot `in_progress` à la fois.
2. Passer le suivant en `ready` seulement après compte rendu Étape E du lot courant `done`.
3. Ne jamais implémenter un lot `blocked`.

## Dernière mise à jour

2026-09-08 — LOT 3 Économie lisible → done (HUD stocks + vue chaînes + processor I/O). Prochain : LOT 4 (ready, non démarré).
