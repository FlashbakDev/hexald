/**
 * Smoke LOT 2 — boulangerie + outputCount + food/surplus + non-régression mill.
 * Exécuter : node --experimental-strip-types packages/game-core/scripts/bakery-craft-smoke.ts
 */
import {
  BAKERY_CRAFT_DURATION_MS,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  getBuildingDefinition,
  getProcessorStepForBuilding,
  recipeInputCount,
  recipeOutputCount
} from "@hexald/content";
import {
  computeCivilizationPoints,
  createInitialEconomy,
  getStockAmount,
  isBuildingUnlocked,
  settleEconomyProduction,
  settleFoodAndGrowth,
  settleProcessorTiles
} from "../src/index.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const bakery = getBuildingDefinition("bakery");
assert(bakery, "bakery definition missing");
assert(bakery.placeable === true, "bakery must be placeable");
assert(bakery.requiredTechId === "pottery", "bakery tech must be pottery");
assert(bakery.woodCost === 30, "bakery wood cost must be 30");
assert(bakery.buildDurationMs === 60_000, "bakery build duration must be 60s");
assert(bakery.maxWorkers === 1, "bakery max workers must be 1");
assert(bakery.role === "processor", "bakery role must be processor");
assert(bakery.workerJob === "artisan", "bakery worker must be artisan");

const step = getProcessorStepForBuilding("bakery");
assert(step?.input === "flour", "bakery input must be flour");
assert(step?.output === "food", "bakery output must be food");
assert(recipeInputCount(step!) === 1, "bakery inputCount must be 1");
assert(recipeOutputCount(step!) === 2, "bakery outputCount must be 2");
assert(BAKERY_CRAFT_DURATION_MS === 120_000, "bakery cycle must be 120s");

assert(!isBuildingUnlocked("bakery", []), "bakery locked without pottery");
assert(
  isBuildingUnlocked("bakery", ["pottery"]),
  "bakery unlocked with pottery"
);

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const cycle = 120_000;

function villageTile() {
  return {
    q: 0,
    r: 0,
    buildingId: "village" as const,
    assignedWorkers: 0,
    constructionCompletesAt: null
  };
}

function bakeryTile(overrides: Record<string, unknown> = {}) {
  return {
    q: 1,
    r: 0,
    buildingId: "bakery" as const,
    assignedWorkers: 1,
    constructionCompletesAt: null,
    processorInputBuffer: 0,
    craftCompletesAt: null as number | null,
    ...overrides
  };
}

function withFlour(state: ReturnType<typeof createInitialEconomy>, amount: number) {
  return {
    ...state,
    stocks: {
      ...state.stocks,
      flour: { amount, lastCalculatedAt: now },
      food: { amount: state.stocks.food?.amount ?? 0, lastCalculatedAt: now }
    }
  };
}

// --- Craft simple : 1 farine → +2 food ---
{
  let state = withFlour(createInitialEconomy(now), 5);
  const foodBefore = getStockAmount(state, "food");
  const tiles = [villageTile(), bakeryTile()];
  const started = settleProcessorTiles(state, tiles, now);
  assert(started.changed, "bakery should start craft with flour + worker");
  assert(
    getStockAmount(started.state, "flour") === 4,
    `expected 4 flour after start, got ${getStockAmount(started.state, "flour")}`
  );
  assert(
    started.tiles[1]?.craftCompletesAt === now + cycle,
    "craft should end in 120s"
  );
  assert(
    Math.floor(started.tiles[1]?.processorInputBuffer ?? 0) === 1,
    "pending output units should be 1"
  );

  const finished = settleProcessorTiles(
    started.state,
    started.tiles,
    now + cycle
  );
  assert(
    getStockAmount(finished.state, "food") === foodBefore + 2,
    `expected +2 food, got ${getStockAmount(finished.state, "food") - foodBefore}`
  );
  assert(
    finished.state.foodSurplusAccumulated >= 2,
    "bakery food must credit foodSurplusAccumulated"
  );
}

// --- Deux cycles ---
{
  let state = withFlour(createInitialEconomy(now), 2);
  const foodBefore = getStockAmount(state, "food");
  let tiles = [villageTile(), bakeryTile()];
  const t1 = settleProcessorTiles(state, tiles, now);
  const t2 = settleProcessorTiles(t1.state, t1.tiles, now + cycle);
  const t3 = settleProcessorTiles(t2.state, t2.tiles, now + 2 * cycle);
  assert(
    getStockAmount(t3.state, "food") === foodBefore + 4,
    `expected +4 food after 2 cycles, got ${getStockAmount(t3.state, "food") - foodBefore}`
  );
  assert(
    getStockAmount(t3.state, "flour") === 0,
    `expected 0 flour, got ${getStockAmount(t3.state, "flour")}`
  );
}

// --- Input limitant : 1 farine, 20 min (craft déjà lancé) ---
{
  let state = withFlour(createInitialEconomy(now), 1);
  const foodBefore = getStockAmount(state, "food");
  let tiles = [villageTile(), bakeryTile()];
  const started = settleProcessorTiles(state, tiles, now);
  const settled = settleProcessorTiles(
    started.state,
    started.tiles,
    now + 20 * 60_000
  );
  assert(
    getStockAmount(settled.state, "food") === foodBefore + 2,
    `input-limited: expected +2 food, got ${getStockAmount(settled.state, "food") - foodBefore}`
  );
  assert(
    getStockAmount(settled.state, "flour") === 0,
    "input-limited: flour must be 0"
  );
}

// --- Worker limitant ---
{
  let state = withFlour(createInitialEconomy(now), 10);
  const foodBefore = getStockAmount(state, "food");
  const tiles = [villageTile(), bakeryTile({ assignedWorkers: 0 })];
  const settled = settleProcessorTiles(state, tiles, now + 20 * 60_000);
  assert(
    getStockAmount(settled.state, "food") === foodBefore,
    "no worker → no food"
  );
  assert(
    getStockAmount(settled.state, "flour") === 10,
    "no worker → flour untouched"
  );
}

// --- Hors influence ---
{
  let state = withFlour(createInitialEconomy(now), 10);
  const foodBefore = getStockAmount(state, "food");
  // bakery alone far from village → orphan
  const tiles = [
    villageTile(),
    bakeryTile({ q: 5, r: 5, assignedWorkers: 1 })
  ];
  const settled = settleProcessorTiles(state, tiles, now + 20 * 60_000);
  assert(
    getStockAmount(settled.state, "food") === foodBefore,
    "orphan bakery → no food"
  );
  assert(
    (settled.tiles[1]?.assignedWorkers ?? 0) === 0,
    "orphan bakery releases workers"
  );
}

// --- Double settle idempotent ---
{
  let state = withFlour(createInitialEconomy(now), 3);
  const tiles = [villageTile(), bakeryTile()];
  const mid = settleProcessorTiles(state, tiles, now + cycle);
  const again = settleProcessorTiles(mid.state, mid.tiles, now + cycle);
  assert(
    getStockAmount(again.state, "food") === getStockAmount(mid.state, "food"),
    "double settle must not duplicate food"
  );
  assert(
    getStockAmount(again.state, "flour") === getStockAmount(mid.state, "flour"),
    "double settle must not duplicate flour spend"
  );
}

// --- Offline 5 farine / 10 min → max 5 crafts / +10 food ---
{
  let state = withFlour(createInitialEconomy(now), 5);
  const foodBefore = getStockAmount(state, "food");
  const tiles = [villageTile(), bakeryTile()];
  const started = settleProcessorTiles(state, tiles, now);
  const later = now + 10 * 60_000;
  const settled = settleProcessorTiles(started.state, started.tiles, later);
  assert(
    getStockAmount(settled.state, "food") === foodBefore + 10,
    `offline: expected +10 food, got ${getStockAmount(settled.state, "food") - foodBefore}`
  );
  assert(
    getStockAmount(settled.state, "flour") === 0,
    "offline: all 5 flour consumed"
  );
}

// --- Croissance : bakery food → surplus → pop ---
{
  let state = withFlour(createInitialEconomy(now), 1);
  state = {
    ...state,
    population: 4,
    populationCap: 5,
    foodSurplusAccumulated: POP_GROWTH_SURPLUS_FOOD_REQUIRED - 2
  };
  const tiles = [villageTile(), bakeryTile()];
  const beforeFood = settleEconomyProduction(state, now);
  const started = settleProcessorTiles(beforeFood, tiles, now);
  const proc = settleProcessorTiles(started.state, started.tiles, now + cycle);
  const after = settleFoodAndGrowth(proc.state, now + cycle);
  assert(after.population === 5, `expected pop 5, got ${after.population}`);
}

// --- PC bakery active ---
{
  const points = computeCivilizationPoints({
    population: 4,
    unlockedTechIds: ["pottery"],
    tiles: [
      {
        q: 0,
        r: 0,
        buildingId: "village",
        constructionCompletesAt: null,
        assignedWorkers: 0
      },
      {
        q: 1,
        r: 0,
        buildingId: "bakery",
        constructionCompletesAt: null,
        assignedWorkers: 1
      }
    ],
    now
  });
  assert(points.production >= 12, `expected >=12 production PC, got ${points.production}`);
}

// --- Non-régression moulin : 5 wheat → 1 flour ---
{
  let state = createInitialEconomy(now);
  state = {
    ...state,
    stocks: {
      ...state.stocks,
      wheat: { amount: 10, lastCalculatedAt: now },
      flour: { amount: 0, lastCalculatedAt: now }
    }
  };
  const tiles = [
    villageTile(),
    {
      q: 1,
      r: 0,
      buildingId: "mill" as const,
      assignedWorkers: 1,
      constructionCompletesAt: null,
      processorInputBuffer: 0,
      craftCompletesAt: null as number | null
    }
  ];
  const started = settleProcessorTiles(state, tiles, now);
  assert(getStockAmount(started.state, "wheat") === 5, "mill consumes 5 wheat");
  const done = settleProcessorTiles(started.state, started.tiles, now + cycle);
  assert(
    getStockAmount(done.state, "flour") === 1,
    `mill must still produce 1 flour, got ${getStockAmount(done.state, "flour")}`
  );
}

// --- Non-régression forge outputCount 1 ---
{
  let state = createInitialEconomy(now);
  state = {
    ...state,
    stocks: {
      ...state.stocks,
      iron_ingot: { amount: 5, lastCalculatedAt: now },
      tools: { amount: 0, lastCalculatedAt: now }
    }
  };
  const tiles = [
    villageTile(),
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
  const done = settleProcessorTiles(started.state, started.tiles, now + cycle);
  assert(
    getStockAmount(done.state, "tools") === 1,
    `forge must still produce 1 tool, got ${getStockAmount(done.state, "tools")}`
  );
}

console.log("bakery-craft-smoke: ok");
