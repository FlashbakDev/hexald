# Hexald — Project Hub

Site statique de documentation et de suivi. Ce n’est pas le jeu. À garder ouvert pendant le développement.

## Ouvrir

Depuis la racine du dépôt :

```text
docs/index.html
```

Aucun serveur, aucun build, aucun framework.

## Structure de ce dossier

```text
docs/
├── index.html          Contenu du hub
├── css/style.css       Design system et composants
├── js/app.js           Navigation, recherche, kanban, notes
├── assets/             Logo, favicon, motif
└── README.md
```

Le reste du monorepo (`apps/`, `packages/`) est un niveau au-dessus.

## Où modifier les données

Tout le contenu du hub vit dans `index.html`.

| Besoin | Où |
| --- | --- |
| Pitch, piliers, roadmap, MVP | Sections correspondantes dans `index.html` |
| Décisions | `#decisions` |
| Tâches | `#backlog` |
| Idées | `#ideas` |
| Styles / composants | `css/style.css` (`:root` pour les couleurs) |
| Interactions | `js/app.js` |

Le JavaScript est facultatif. Notes rapides et backlog kanban utilisent `localStorage` dans ce navigateur uniquement.

## Ajouter une décision

1. Copier le bloc `.decision.decision-template` dans `#decisions`.
2. Retirer la classe `decision-template`.
3. Remplacer `DEC-00X` par le prochain ID (`DEC-015`, …).
4. Remplir date, titre, statut, contexte, décision, raison, conséquences.

## Ajouter une phase

Dans `#roadmap`, dupliquer un `.roadmap-item` :

- `is-current` pour la phase en cours
- `is-done` pour une phase terminée

Mettre à jour aussi les cartes du dashboard (`#overview`) si la phase change.

## Ajouter une tâche

Dans `#backlog`, ajouter un article :

```html
<article class="task" draggable="true" data-id="task-mon-id-unique">
  <strong>Titre</strong>
  <p>Détail</p>
</article>
```

`data-id` doit être unique. Le glisser-déposer enregistre la colonne dans `localStorage`.
