# Hexald

## Comment c'est rangé

- `docs/index.html` — Project Hub (source de vérité design / DEC / roadmap)
- `docs/lots/` — plan d’exécution Phase 4+ (`EXECUTION-PLAN.md`, `STATUS.md`, fiches `LOT-XX`)
- `apps/web/content/news/` — patch notes joueurs (`/news`)
- `docs/patchnotes/` — pointeur uniquement (ne pas dupliquer)
- `.cursor/rules/` — règles Cursor (priorités, architecture, workflow lots)

## Les commandes

- Ouvrir `docs/index.html` dans le navigateur (pas de build)

# Les règles

- Toute décision design structurante → article `DEC-0XX` dans `#decisions` (prochain : **DEC-028**)
- Exécution gameplay → lots dans `docs/lots/` (un seul `in_progress`)
- Actus joueurs → Markdown dans `apps/web/content/news/` uniquement
- Dernière DEC design : DEC-027 (PC) ; DEC-026 (influence) ; auth/ops : DEC-025 (admin)
