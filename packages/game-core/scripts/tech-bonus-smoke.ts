/**
 * Smoke test LOT 4 — bonus tech pâturage / plantation / lumber / maçonnerie + fusion.
 * Exécuter : node --experimental-strip-types packages/game-core/scripts/tech-bonus-smoke.ts
 */
import {
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  IRON_ORE_RATE_PER_WORKER_PER_MINUTE,
  FUSION_TILE_PRODUCTION_BONUS
} from "@hexald/content";
import {
  createInitialEconomy,
  woodRateFromState,
  stoneRateFromState,
  ironOreRateFromState,
  techFoodBonusPerMinute,
  techFoodBonusBreakdown,
  extractorSiteRateBreakdown,
  countPastureTiles,
  type EconomyState,
  type ExtractorSite
} from "../src/index.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function withSites(
  base: EconomyState,
  patch: Partial<EconomyState> & { extractorSites: ExtractorSite[] }
): EconomyState {
  return { ...base, ...patch };
}

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const base = createInitialEconomy(now);

// —— Lumber : élevage + 2 camps → +2 bois ; sans tech → +0 ——
{
  const sites: ExtractorSite[] = [
    {
      buildingId: "lumber_camp",
      biome: "forest",
      workers: 1,
      complete: true,
      influenced: true
    },
    {
      buildingId: "lumber_camp",
      biome: "forest",
      workers: 1,
      complete: true,
      influenced: true
    }
  ];
  const withoutTech = withSites(base, {
    hasLumberCamp: true,
    lumberCampSites: 2,
    woodcutters: 2,
    extractorSites: sites,
    unlockedTechIds: ["foundations", "agriculture"]
  });
  const withTech = withSites(withoutTech, {
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry"]
  });
  const expectedBase = 2 * WOOD_RATE_PER_WORKER_PER_MINUTE;
  assert(
    woodRateFromState(withoutTech) === expectedBase,
    `wood without tech: expected ${expectedBase}, got ${woodRateFromState(withoutTech)}`
  );
  assert(
    woodRateFromState(withTech) === expectedBase + 2,
    `wood with élevage: expected ${expectedBase + 2}, got ${woodRateFromState(withTech)}`
  );
}

// —— Fusion × workers×base only ; tech flat not multiplied ——
{
  const site: ExtractorSite = {
    buildingId: "lumber_camp",
    biome: "forest_plains",
    workers: 1,
    complete: true,
    influenced: true
  };
  const state = withSites(base, {
    hasLumberCamp: true,
    lumberCampSites: 1,
    woodcutters: 1,
    extractorSites: [site],
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry"]
  });
  const fusedBase =
    WOOD_RATE_PER_WORKER_PER_MINUTE * (1 + FUSION_TILE_PRODUCTION_BONUS);
  const expected = fusedBase + 1;
  assert(
    Math.abs(woodRateFromState(state) - expected) < 1e-9,
    `fusion+tech: expected ${expected}, got ${woodRateFromState(state)}`
  );
  const parts = extractorSiteRateBreakdown({
    buildingId: "lumber_camp",
    biome: "forest_plains",
    workers: 1,
    complete: true,
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry"]
  });
  assert(parts.base === WOOD_RATE_PER_WORKER_PER_MINUTE, "breakdown base");
  assert(
    Math.abs(parts.fusionBonus - WOOD_RATE_PER_WORKER_PER_MINUTE * FUSION_TILE_PRODUCTION_BONUS) <
      1e-9,
    "breakdown fusion"
  );
  assert(parts.techBonus === 1, "breakdown tech flat = 1");
  assert(Math.abs(parts.total - expected) < 1e-9, "breakdown total");
}

// —— Pottery + 1 farm → plantation food +1 ——
{
  const sites: ExtractorSite[] = [
    {
      buildingId: "farm",
      biome: "plains",
      workers: 1,
      complete: true,
      influenced: true
    }
  ];
  const withPottery = withSites(base, {
    hasFarm: true,
    farmSites: 1,
    farmers: 1,
    extractorSites: sites,
    unlockedTechIds: ["foundations", "agriculture", "pottery"],
    pastureTileCount: 0
  });
  assert(
    techFoodBonusPerMinute(withPottery) === 1,
    `plantation food bonus expected 1, got ${techFoodBonusPerMinute(withPottery)}`
  );
  const without = withSites(withPottery, {
    unlockedTechIds: ["foundations", "agriculture"]
  });
  assert(techFoodBonusPerMinute(without) === 0, "no pottery → no plantation");
}

// —— Masonry quarry / mine ——
{
  const quarrySites: ExtractorSite[] = [
    {
      buildingId: "quarry",
      biome: "mountain",
      workers: 1,
      complete: true,
      influenced: true
    }
  ];
  const mineSites: ExtractorSite[] = [
    {
      buildingId: "mine",
      biome: "mountain",
      workers: 1,
      complete: true,
      influenced: true
    }
  ];
  const quarry = withSites(base, {
    hasQuarry: true,
    quarrySites: 1,
    quarriers: 1,
    extractorSites: quarrySites,
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry", "masonry"]
  });
  const mine = withSites(base, {
    hasMine: true,
    mineSites: 1,
    miners: 1,
    extractorSites: mineSites,
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry", "masonry"]
  });
  assert(
    stoneRateFromState(quarry) === STONE_RATE_PER_WORKER_PER_MINUTE + 1,
    `quarry+masonry expected ${STONE_RATE_PER_WORKER_PER_MINUTE + 1}, got ${stoneRateFromState(quarry)}`
  );
  assert(
    ironOreRateFromState(mine) === IRON_ORE_RATE_PER_WORKER_PER_MINUTE + 1,
    `mine+masonry expected ${IRON_ORE_RATE_PER_WORKER_PER_MINUTE + 1}, got ${ironOreRateFromState(mine)}`
  );
}

// —— Pasture : cow_herd sans ferme → +1 ; avec ferme → 0 pâturage ——
{
  const pastureTiles = [
    { poiId: "cow_herd", buildingId: null },
    { poiId: "cow_herd", buildingId: "farm" }
  ];
  assert(countPastureTiles(pastureTiles) === 1, "only open pasture counts");
  const food = techFoodBonusBreakdown({
    unlockedTechIds: ["foundations", "agriculture", "animal_husbandry"],
    pastureTileCount: countPastureTiles(pastureTiles),
    completedFarmCount: 0
  });
  assert(food.pasture === 1, `pasture bonus expected 1, got ${food.pasture}`);
  assert(food.plantation === 0, "no farm → no plantation");
}

console.log("tech-bonus-smoke: ok");
