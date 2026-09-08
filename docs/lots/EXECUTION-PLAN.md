# HEXALD — Plan d’exécution des prochains lots

Tu travailles sur **Hexald**, un city-builder / jeu de stratégie idle persistant sur carte hexagonale personnelle.

L’objectif n’est PAS d’ajouter un maximum de fonctionnalités.

L’objectif prioritaire est de transformer l’état actuel en un jeu :

- fonctionnel de bout en bout ;
- immédiatement compréhensible ;
- agréable à manipuler ;
- visuellement attractif ;
- avec une progression qui donne envie de continuer ;
- techniquement propre et cohérent avec l’architecture existante.

Avancer **lot par lot**, dans l’ordre défini ci-dessous.

Ne jamais commencer le lot suivant avant d’avoir terminé, testé et validé le précédent.

Suivi opérationnel : [`STATUS.md`](./STATUS.md).  
Méthode par lot : [`.cursor/rules/hexald-lot-workflow.mdc`](../../.cursor/rules/hexald-lot-workflow.mdc).

---

## 0. Règle directrice

Pour chaque décision, utiliser cet ordre de priorité :

1. La boucle de jeu fonctionne-t-elle ?
2. Le joueur comprend-il quoi faire ?
3. L’action produit-elle un feedback satisfaisant ?
4. La progression crée-t-elle une raison de continuer ?
5. L’interface rend-elle les systèmes lisibles ?
6. Le système est-il techniquement robuste ?
7. Seulement ensuite : ajouter de la profondeur.

Éviter absolument le feature creep.

Une fonctionnalité existante incomplète a priorité sur une nouvelle fonctionnalité.

---

## 1. Architecture à respecter

Conserver les principes actuels de Hexald.

- `docs/index.html` = source de vérité design / Project Hub.
- `packages/content` = contenu et données.
- `packages/game-core` = règles de jeu.
- `packages/shared` = contrats et types partagés.
- `apps/api` = autorité serveur.
- `apps/web` = interface et représentation.
- PostgreSQL + Drizzle = persistance.
- Production / settle lazy.
- Pas de tick serveur permanent.
- Les mutations monde doivent rester sérialisées.
- Three.js doit rester isolé à la carte.
- Ne pas déplacer de logique autoritaire importante dans le client.

Avant toute modification importante, inspecter l’existant et réutiliser les patterns déjà présents.

Ne pas créer une seconde implémentation parallèle d’un système existant.

---

## 2. Méthode obligatoire pour chaque lot

### Étape A — Audit

Avant de coder :

- identifier les fichiers concernés ;
- comprendre les modèles existants ;
- identifier les helpers/règles déjà présentes ;
- relever les incohérences éventuelles entre runtime, contenu, UI et documentation ;
- déterminer le plus petit changement permettant de terminer réellement le système.

Ne pas refactorer des zones sans rapport direct avec le lot.

### Étape B — Proposition

Présenter brièvement :

- comportement attendu ;
- changements nécessaires ;
- éventuelles migrations DB ;
- impacts game-core ;
- impacts API ;
- impacts UI ;
- tests nécessaires.

Favoriser la solution la plus simple compatible avec l’architecture existante.

### Étape C — Implémentation

Implémenter complètement le lot :

- règles ;
- données ;
- persistance si nécessaire ;
- API ;
- interface ;
- feedback utilisateur ;
- états d’erreur ;
- documentation utile.

Ne pas laisser un système « techniquement présent mais invisible ».

### Étape D — Validation

Avant de déclarer le lot terminé :

- typecheck ;
- lint si disponible ;
- tests existants ;
- nouveaux tests ciblés ;
- build ;
- vérification des erreurs runtime évidentes ;
- vérification de la boucle joueur concernée.

Tester également :

- stock insuffisant ;
- worker manquant ;
- bâtiment en construction ;
- bâtiment sans input ;
- stockage saturé ;
- influence perdue si concerné ;
- reconnexion / settle lazy ;
- état après refresh.

### Étape E — Compte rendu

À la fin du lot, fournir :

#### Réalisé

Ce qui fonctionne maintenant.

#### Fichiers importants modifiés

Liste courte.

#### Validation

Tests/build exécutés et résultat.

#### Points restant éventuellement

Uniquement les vrais points non bloquants.

#### Prochain lot

Indiquer le prochain lot prévu, **sans l’implémenter** tant que le lot courant n’est pas réellement terminé.

Mettre à jour [`STATUS.md`](./STATUS.md) et la fiche `LOT-XX-*.md` correspondante.

---

## LOT 1 — Terminer la chaîne fer → outils

**Objectif :** fermer Mine → minerai → fonderie → lingot → **forge** → outils.

La forge existe dans le catalogue mais n’est pas encore réellement jouable.

**À faire :** auditer scierie / moulin / briqueterie / fonderie ; réutiliser le même modèle processor (`worker`, input, buffer, cadence, `processorInputRate`, `craftCompletesAt`, settle lazy) ; rendre la Forge posable (tech Métallurgie, coût, terrain, workers, lingots → outils, persistence, influence, PC).

**UX :** le joueur comprend immédiatement « mes lingots servent à fabriquer des outils » (input / output / cadence / worker / actif-bloqué / raison).

**DoD :** partir du monde initial et posséder des **outils** via la chaîne normale.

Fiche : [`LOT-01-forge-outils.md`](./LOT-01-forge-outils.md).

---

## LOT 2 — Terminer la chaîne blé → nourriture

**Statut :** done

**Objectif :** Ferme → blé → moulin → farine → **boulangerie** → nourriture.

La farine ne doit plus être un cul-de-sac. Réutiliser le modèle processor. Nourriture = ressource `food` existante (surplus / croissance). Pas de seconde ressource « food transformée ».

**DoD :** la boulangerie contribue réellement à la croissance démographique.

Fiche : [`LOT-02-boulangerie-food.md`](./LOT-02-boulangerie-food.md).

---

## LOT 3 — Rendre toute l’économie lisible

**Statut :** done

Rendre visibles les ressources secondaires (planches, farine, argile, briques, minerai, lingots, outils…) sans transformer le HUD en dashboard Excel. Respecter le chrome « nuages ».

Deux niveaux : immédiat (pop / food / bois / éclats / or) + détaillé (chaînes, stocks/caps, progressive disclosure). Pas de `+X/min` approximatif dans la vue détaillée.

**DoD :** le joueur répond facilement : que possède-je ? que produis-je ? pourquoi cette usine est arrêtée ?

Fiche : [`LOT-03-economie-lisible.md`](./LOT-03-economie-lisible.md).

---

## LOT 4 — Fiabiliser les bonus technologiques existants

**Statut :** ready

Auditer pâturage, plantation/ferme, lumber, carrière+maçonnerie, mine+maçonnerie : application serveur réelle, pas de doublons, tests, affichage UI du breakdown (base + tech + fusion).

**DoD :** aucune tech ne prétend offrir un bonus sans effet réel ou invisible.

---

## LOT 5 — Feedback et plaisir de jeu

Améliorer le game feel des actions fréquentes (sélection, chantier, pose, fin de build, workers, craft, tech, pop, région) sans changer profondément les règles. Animations / badges / pulses avec retenue. Sons seulement si infra déjà légère.

**DoD :** construire quelque chose est plus satisfaisant qu’avant à valeurs numériques égales.

---

## LOT 6 — Améliorer le parcours des 20 premières minutes

Auditer le parcours nouveau joueur après le tutoriel. Éviter « tuto terminé → je ne sais plus quoi faire ». Recommandations contextuelles légères (pas un système de quêtes).

**DoD :** progression sans doc externe.

---

## LOT 7 — Équilibrage de la boucle principale

Simuler le parcours réel ; mesurer temps morts / goulots ; alternance décision → attente courte → récompense → nouveau choix.

**DoD :** décisions intéressantes régulières sans frénésie.

---

## LOT 8 — Polish visuel du diorama

Priorité au monde (silhouettes, extracteur vs processor, POI, fusions, influence, états actifs). Préserver perf / streaming GPU / mobile.

**DoD :** deux stratégies différentes commencent à se lire sur la carte.

---

## LOT 9 — Objectifs et rétention légère

Uniquement si lots 1–8 solides. Raisons de revenir sans FOMO artificiel (offline, tech, pop, expansion, PC). Pas de daily quests complexes / battle pass / P2W.

---

## LOT 10 — Adjacences et profondeur stratégique

Seulement après validation des lots 1–9. 3–5 bonus d’adjacence significatifs, lisibles, sans réécrire l’économie.

---

## Lots à reporter

Ne pas prioriser tant que le cœur n’est pas excellent :

fleuves complexes · multi-villages · routes complexes · monument multi-hex · PvP · combat · NPC · quêtes narratives · bonheur · culture · social avancé · commerce J-J · monétisation.

---

## Critères globaux de sortie de Phase 4

1. Toutes les ressources importantes ont une utilité compréhensible.
2. Chaînes bois, nourriture, argile et fer fonctionnelles.
3. Forge → outils fonctionne.
4. Boulangerie → nourriture fonctionne.
5. Stocks industriels importants visibles.
6. Processors indiquent clairement pourquoi ils tournent ou non.
7. Technologies : effets réels.
8. Influence sans états incohérents.
9. Settle lazy / offline sur toute la chaîne.
10. Début de partie guide correctement.
11. Feedback satisfaisant à la construction / unlock.
12. Pas de gros temps morts involontaires en early.
13. Refresh / reconnexion OK.
14. Build de production propre.
15. Règles importantes testées.

---

## Règle pour les DEC

Prochain identifiant : **DEC-028**.

Créer une DEC uniquement pour une décision structurante / difficile à inverser.

Ne pas créer une DEC pour chaque petit changement de valeur ou détail UI.

Mettre à jour le hub (`docs/index.html`) lorsque le comportement implémenté change la source de vérité.
