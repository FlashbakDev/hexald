/**
 * Smoke Lot 3 — progressive disclosure (pas de DB).
 * Run: pnpm exec tsx apps/web/scripts/economy-panel-smoke.ts
 */
import assert from "node:assert/strict";
import {
  buildEconomyPanelChains,
  isResourceVisible
} from "../app/utils/resourceUi.ts";

// Nouveau joueur : seulement cœur
{
  const chains = buildEconomyPanelChains({
    amounts: { wood: 30, food: 0, worldshard: 1, gold: 0 },
    caps: { wood: 200, food: 80, worldshard: 5, gold: 80 },
    unlockedTechIds: ["foundations"],
    ownedBuildingIds: ["village"]
  });
  const ids = chains.flatMap((c) => c.rows.map((r) => r.resourceId));
  assert.ok(ids.includes("wood"));
  assert.ok(ids.includes("food"));
  assert.ok(ids.includes("worldshard"));
  assert.ok(ids.includes("gold"));
  assert.equal(ids.includes("flour"), false);
  assert.equal(ids.includes("iron_ingot"), false);
  assert.equal(ids.includes("tools"), false);
}

// Farine après stock
assert.equal(
  isResourceVisible("flour", {
    amount: 2,
    unlockedTechIds: [],
    ownedBuildingIds: []
  }),
  true
);

// Lingot via tech métallurgie
assert.equal(
  isResourceVisible("iron_ingot", {
    amount: 0,
    unlockedTechIds: ["metallurgy"],
    ownedBuildingIds: []
  }),
  true
);

// Outils via forge posée
assert.equal(
  isResourceVisible("tools", {
    amount: 0,
    unlockedTechIds: [],
    ownedBuildingIds: ["forge"]
  }),
  true
);

console.log("economy-panel-smoke: ok");
