# LOT 5 — Feedback & game feel

**Statut :** `done`  
**DoD :** construire / faire progresser un bâtiment est clairement plus satisfaisant qu’avant, à valeurs numériques égales.

## Périmètre

- Feedback carte / UI sur : pose, fin de chantier, assign workers, fin de craft.
- Réutiliser floaters, toasts, pulses existants.
- **Sans** sons, sans changement de règles, sans polish diorama (LOT 8), sans FTUE (LOT 6).

## Livré

- Helper `spawnMapFloater` / `celebrateTileFeel` (généralise destroy-float) + CSS kinds `build` / `ready` / `craft`.
- `pulseTile(q, r)` scène (`createHexScene` → `HexPreview`) : flash emissive / lift ~380 ms, gate `prefers-reduced-motion`.
- Pose : floater « Chantier » + pulse tuile (toast place volontairement absent).
- Fin de chantier : toast existant + pulse + floater « Prêt » (`onConstructionComplete`).
- Workers ± : pulse one-shot badge carte + stepper sheet (pas de toast).
- Craft : kind `craft_complete` (prefs, défaut on) + toast « Bâtiment : +N ressource » + floater carte / pulse via `onCraftComplete`.

## Validation

- Pose camp → fin timer → assign → craft scierie : feedback carte + toasts attendus.
- `prefers-reduced-motion` : pas de floaters / pulses.
- Pref notif craft off : toast off, floater carte toujours.

## Prochain lot

**LOT 6 — Parcours 20 premières minutes** (`ready`) — ne pas démarrer ici.
