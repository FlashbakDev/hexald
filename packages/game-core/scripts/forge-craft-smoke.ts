/**
 * Smoke test LOT 1 — forge processor settle (pas de runner vitest dans le monorepo).
 * Exécuter : pnpm exec tsx packages/game-core/scripts/forge-craft-smoke.ts
 */
import {
  createInitialEconomy,
  getStockAmount,
  settleProcessorTiles
} from "../src/index.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const later = now + 120_000;

let state = createInitialEconomy(now);
state = {
  ...state,
  stocks: {
    ...state.stocks,
    iron_ingot: { amount: 10, lastCalculatedAt: now },
    tools: { amount: 0, lastCalculatedAt: now }
  }
};

const tiles = [
  {
    q: 0,
    r: 0,
    buildingId: "village" as const,
    assignedWorkers: 0,
    constructionCompletesAt: null
  },
  {
    q: 1,
    r: 0,
    buildingId: "forge" as const,
    assignedWorkers: 1,
    constructionCompletesAt: null,
    processorInputBuffer: 0,
    craftCompletesAt: null as number | null
  }
];

const started = settleProcessorTiles(state, tiles, now);
assert(started.changed, "forge should start a craft with 5 ingots + 1 worker");
assert(
  getStockAmount(started.state, "iron_ingot") === 5,
  `expected 5 ingots left, got ${getStockAmount(started.state, "iron_ingot")}`
);
assert(
  started.tiles[1]?.craftCompletesAt === now + 120_000,
  "craft should end in 120s"
);
assert(
  Math.floor(started.tiles[1]?.processorInputBuffer ?? 0) === 1,
  "pending output units should be 1"
);

const finished = settleProcessorTiles(started.state, started.tiles, later);
assert(finished.changed, "forge should deliver tools when craft ends");
assert(
  getStockAmount(finished.state, "tools") === 1,
  `expected 1 tool, got ${getStockAmount(finished.state, "tools")}`
);
assert(
  getStockAmount(finished.state, "iron_ingot") === 0,
  `expected 0 ingots after second cycle start, got ${getStockAmount(finished.state, "iron_ingot")}`
);
// Avec encore 5 lingots + worker, un nouveau cycle peut démarrer immédiatement.
assert(
  finished.tiles[1]?.craftCompletesAt === later + 120_000 ||
    finished.tiles[1]?.craftCompletesAt == null,
  "after delivery, idle or next craft started"
);

console.log("forge-craft-smoke: ok");
