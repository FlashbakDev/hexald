<script setup lang="ts">
import type {
  BiomeId,
  BuildingId,
  HexCoord,
  PrimaryBiomeId,
  WorldTileSnapshot
} from "@hexald/shared";
import {
  biomes,
  buildings,
  BUILD_COST_WOOD,
  BUILD_IDLE_POP_REQUIREMENT,
  BUILD_DURATION_MS,
  DEV_BUILD_DURATION_MS,
  getBiomeDefinition,
  getBuildingDefinition,
  getPoiDefinition,
  getTechNode,
  buildingRequiredTech,
  listPlaceableBuildings,
  primaryBiomes,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE,
  TOWN_HALL_WORLDSHARD_INTERVAL_MS,
  type PlaceableBuildingId,
  type PlaceableExtractorId,
  type TechId,
  lumberCampTechBonusPerMinute,
  quarryMasonryBonusPerMinute
} from "@hexald/content";
import {
  computePopulationCap,
  computeRegionExpansionCost,
  listBuildOptionsForTile,
  isBuildingUnlocked,
  isBuildingUnderConstruction,
  isFusionBiome,
  committedWorkersFromTiles,
  tileProductionMultiplier,
  woodRefundOnDestroy,
  adjacentRegionCenters,
  canPlaceRegion,
  WORKERS_PER_EXTRACTOR_L1
} from "@hexald/game-core";
import type { HexScreenPoint, SelectedTile } from "~/renderer/createHexScene";
import type { TutorialHole } from "~/composables/usePlayTutorial";
import {
  PLAY_TUTORIAL_STEPS,
  usePlayTutorial
} from "~/composables/usePlayTutorial";

definePageMeta({
  layout: "blank"
});

const { pseudo, ensureSession } = useSession();
const { logoutFirebase } = useFirebaseAuth();
const {
  ensureWorld,
  expandRegion,
  assignWorkers,
  buildBuilding,
  destroyBuilding,
  resetWorld,
  grantDevResources,
  setTileBiomeDev,
  refreshWorld,
  setResearchTarget,
  world,
  error: worldError
} = useWorld();

const {
  open: linkAccountOpen,
  isGuest,
  maybeAutoShow: maybeShowLinkAccount,
  show: showLinkAccount,
  dismiss: dismissLinkAccount
} = useLinkAccountPrompt();

useGameNotifications(world);

const { enabledCount: notificationEnabledCount, totalCount: notificationTotalCount } =
  useNotificationPreferences();

const settingsOpen = ref(false);
const settingsRoot = ref<HTMLElement | null>(null);
const disconnecting = ref(false);
const disconnectConfirmOpen = ref(false);
const supportOpen = ref(false);
const notificationSettingsOpen = ref(false);
const techTimelineOpen = ref(false);
const constructionMenuOpen = ref(false);
const selectingResearch = ref(false);
const researchUnlockNotice = ref<string | null>(null);
const unlockedTechKey = ref("");

watch(
  () => world.value?.research,
  (research) => {
    if (!research) return;
    const key = [...research.unlockedTechIds].sort().join(",");
    if (unlockedTechKey.value && key !== unlockedTechKey.value) {
      const prev = new Set(unlockedTechKey.value.split(",").filter(Boolean));
      const newly = research.unlockedTechIds.filter(
        (id) => !prev.has(id) && id !== "foundations"
      );
      if (newly.length > 0) {
        const label = getTechNode(newly[0]).label;
        researchUnlockNotice.value = `${label} débloquée — choisis la prochaine recherche.`;
        techTimelineOpen.value = true;
      }
    }
    unlockedTechKey.value = key;
  },
  { deep: true }
);

watch(techTimelineOpen, (open) => {
  if (!open) researchUnlockNotice.value = null;
  if (open) constructionMenuOpen.value = false;
});

watch(constructionMenuOpen, (open) => {
  if (open) techTimelineOpen.value = false;
});

async function onSelectResearchTarget(techId: TechId) {
  const id = world.value?.id;
  if (!id || selectingResearch.value) return;
  selectingResearch.value = true;
  expandError.value = null;
  try {
    const snapshot = await setResearchTarget(id, techId);
    if (!snapshot) {
      expandError.value = worldError.value ?? "Impossible de lancer la recherche.";
    }
  } finally {
    selectingResearch.value = false;
  }
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function closeSettings() {
  settingsOpen.value = false;
}

function openLinkAccountFromSettings() {
  closeSettings();
  showLinkAccount();
}

function openSupportFromSettings() {
  closeSettings();
  supportOpen.value = true;
}

function openNotificationSettingsFromSettings() {
  closeSettings();
  notificationSettingsOpen.value = true;
}

function askDisconnect() {
  if (disconnecting.value) return;
  if (isGuest.value) {
    closeSettings();
    disconnectConfirmOpen.value = true;
    return;
  }
  void disconnect();
}

function cancelDisconnect() {
  disconnectConfirmOpen.value = false;
}

function openLinkAccountFromDisconnect() {
  cancelDisconnect();
  showLinkAccount();
}

async function disconnect() {
  if (disconnecting.value) return;
  disconnecting.value = true;
  disconnectConfirmOpen.value = false;
  settingsOpen.value = false;
  try {
    await logoutFirebase();
    world.value = null;
    await navigateTo("/", { replace: true });
  } finally {
    disconnecting.value = false;
  }
}

function onSettingsPointerDown(event: PointerEvent) {
  if (!settingsOpen.value) return;
  const root = settingsRoot.value;
  if (root && event.target instanceof Node && root.contains(event.target)) {
    return;
  }
  closeSettings();
}

onMounted(() => {
  document.addEventListener("pointerdown", onSettingsPointerDown, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onSettingsPointerDown, true);
});

const session = await ensureSession();
if (!session?.pseudo) {
  await navigateTo("/", { replace: true });
} else {
  await ensureWorld();
}

useHead({
  title: computed(() =>
    pseudo.value ? `${pseudo.value} · Hexald` : "Hexald"
  )
});

const preview = useTemplateRef<{
  clearSelection: () => void;
  applyRegion: (
    center: HexCoord,
    biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => boolean;
  applyBuilding: (q: number, r: number, buildingId: BuildingId) => boolean;
  removeBuilding: (q: number, r: number) => boolean;
  applyTileBiome: (q: number, r: number, biome: BiomeId) => boolean;
  projectTile: (q: number, r: number) => HexScreenPoint | null;
  setTutorialHighlights: (coords: readonly HexCoord[]) => void;
  setBuildHighlights: (
    valid: readonly HexCoord[],
    invalid?: readonly HexCoord[]
  ) => void;
}>("preview");

const stage = useTemplateRef<HTMLElement>("stage");
const selected = ref<SelectedTile | null>(null);
const expanding = ref(false);
const building = ref(false);
const expandError = ref<string | null>(null);
const assigning = ref(false);
const resetting = ref(false);
const granting = ref(false);
const debugBiomeOpen = ref(false);
const debugChromeVisible = ref(true);
const settingBiome = ref(false);
const destroyConfirm = ref(false);
const destroying = ref(false);
const nowTick = ref(Date.now());
const projectedResearch = useProjectedResearch(
  computed(() => world.value?.research),
  nowTick
);
const isDevClient = import.meta.dev;
const DEBUG_CHROME_STORAGE_KEY = "hexald-debug-chrome-visible";

function toggleDebugChrome() {
  debugChromeVisible.value = !debugChromeVisible.value;
}

if (import.meta.client && import.meta.dev) {
  onMounted(() => {
    try {
      const saved = localStorage.getItem(DEBUG_CHROME_STORAGE_KEY);
      if (saved === "0") debugChromeVisible.value = false;
    } catch {
      /* ignore */
    }
  });
  watch(debugChromeVisible, (visible) => {
    try {
      localStorage.setItem(DEBUG_CHROME_STORAGE_KEY, visible ? "1" : "0");
    } catch {
      /* ignore */
    }
  });
}
const { hasNoAds, setDevNoAds } = useAds();
const {
  enabled: tiltEnabled,
  setEnabled: setTiltEnabled,
  authorizeFromUserGesture: authorizeTilt
} = useDeviceTilt({ enabled: true, mouseFallback: true });

async function toggleDeviceTilt() {
  if (!tiltEnabled.value) {
    setTiltEnabled(true);
    await authorizeTilt();
    return;
  }
  setTiltEnabled(false);
}

const {
  active: tutorialActive,
  step: tutorialStep,
  stepIndex: tutorialStepIndex,
  start: startTutorial,
  reset: resetTutorial,
  skip: skipTutorial,
  goNext: nextTutorialStep,
  complete: completeTutorial,
  onTileSelected: tutorialOnTileSelected,
  onBuildingPlaced: tutorialOnBuildingPlaced,
  onRegionCreated: tutorialOnRegionCreated,
  onConstructionSelected: tutorialOnConstructionSelected
} = usePlayTutorial();

const constructionMode = ref<PlaceableBuildingId | null>(null);

const tutorialHoleTick = ref(0);
let tutorialHoleRaf: number | null = null;

const wheelInteractive = ref(false);
let wheelReadyTimer: ReturnType<typeof setTimeout> | null = null;
/** Ancre écran de la roue = centre projeté de la tuile sélectionnée. */
const wheelAnchor = ref<{ x: number; y: number } | null>(null);
let tickTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let overlayRaf: number | null = null;

function scheduleWorldRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const ms = world.value?.research.researchTargetTechId ? 15_000 : 30_000;
  refreshTimer = setInterval(() => {
    void refreshWorld();
  }, ms);
}

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  scheduleWorldRefresh();
  startOverlayLoop();
  if (world.value) {
    window.setTimeout(() => startTutorial(), 700);
  }
  // Popup compte après le tutoriel (ou si pas de tutoriel).
  window.setTimeout(() => {
    if (!tutorialActive.value) maybeShowLinkAccount(0);
  }, 2800);
});

watch(
  () => world.value?.research.researchTargetTechId,
  () => scheduleWorldRefresh()
);

watch(tutorialActive, (on, wasOn) => {
  if (wasOn && !on) maybeShowLinkAccount(900);
});

watch(tutorialActive, (on) => {
  if (tutorialHoleRaf != null) {
    cancelAnimationFrame(tutorialHoleRaf);
    tutorialHoleRaf = null;
  }
  if (!on) return;
  const holeLoop = () => {
    tutorialHoleTick.value += 1;
    tutorialHoleRaf = requestAnimationFrame(holeLoop);
  };
  tutorialHoleRaf = requestAnimationFrame(holeLoop);
});

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (refreshTimer) clearInterval(refreshTimer);
  if (wheelReadyTimer) clearTimeout(wheelReadyTimer);
  if (overlayRaf != null) {
    cancelAnimationFrame(overlayRaf);
    overlayRaf = null;
  }
  if (tutorialHoleRaf != null) {
    cancelAnimationFrame(tutorialHoleRaf);
    tutorialHoleRaf = null;
  }
  for (const timer of destroyFloatTimers) clearTimeout(timer);
  destroyFloatTimers.clear();
});

const economy = computed(() => world.value?.economy ?? null);
const population = computed(() => economy.value?.population ?? 0);
/** Cap recalculé côté client dès qu’un logement achève son chantier. */
const populationCap = computed(() => {
  const tiles = world.value?.tiles;
  if (!tiles?.length) return economy.value?.populationCap ?? 0;
  return computePopulationCap(tiles, nowTick.value);
});
const worldName = computed(() => "No Name");

/** Icônes UI — labels / coûts viennent du catalogue `buildings`. */
const buildingIcons: Record<PlaceableBuildingId, { icon: string; short: string }> = {
  lumber_camp: { icon: "i-lucide-trees", short: "Camp" },
  farm: { icon: "i-lucide-wheat", short: "Ferme" },
  quarry: { icon: "i-lucide-pickaxe", short: "Carrière" },
  fishing_hut: { icon: "i-lucide-fish", short: "Pêche" },
  house: { icon: "i-lucide-home", short: "Maison" }
};

function buildingUi(id: PlaceableBuildingId) {
  const definition = getBuildingDefinition(id);
  const icons = buildingIcons[id];
  return {
    label: definition?.label ?? id,
    icon: icons.icon,
    short: icons.short
  };
}

function projectedStock(
  stock: number,
  cap: number,
  lastIso: string,
  ratePerMinute: number
) {
  const last = Date.parse(lastIso);
  if (Number.isNaN(last)) return Math.floor(stock);
  const minutes = Math.max(0, (nowTick.value - last) / 60_000);
  return Math.min(cap, stock + ratePerMinute * minutes);
}

function extractorRatePerMinute(
  buildingId: PlaceableExtractorId,
  baseRate: number
): number {
  const tiles = world.value?.tiles;
  if (!tiles?.length) return 0;
  const now = nowTick.value;
  let total = 0;
  for (const tile of tiles) {
    if (tile.buildingId !== buildingId) continue;
    if (isBuildingUnderConstruction(tile.constructionCompletesAt, now)) continue;
    const workers = Math.max(0, Math.floor(tile.assignedWorkers ?? 0));
    total += workers * baseRate * tileProductionMultiplier(tile.biome);
  }
  return total;
}

const liveWoodRate = computed(() => {
  const base = extractorRatePerMinute("lumber_camp", WOOD_RATE_PER_WORKER_PER_MINUTE);
  const unlocked = world.value?.research.unlockedTechIds ?? ["foundations"];
  const tiles = world.value?.tiles;
  if (!tiles?.length) return base;
  const now = nowTick.value;
  let campCount = 0;
  for (const tile of tiles) {
    if (tile.buildingId !== "lumber_camp") continue;
    if (isBuildingUnderConstruction(tile.constructionCompletesAt, now)) continue;
    campCount++;
  }
  return base + lumberCampTechBonusPerMinute(unlocked, campCount);
});
const liveWheatRate = computed(() =>
  extractorRatePerMinute("farm", WHEAT_RATE_PER_WORKER_PER_MINUTE)
);
const liveStoneRate = computed(() => {
  const base = extractorRatePerMinute("quarry", STONE_RATE_PER_WORKER_PER_MINUTE);
  const unlocked = world.value?.research.unlockedTechIds ?? ["foundations"];
  const tiles = world.value?.tiles;
  if (!tiles?.length) return base;
  const now = nowTick.value;
  let quarryCount = 0;
  for (const tile of tiles) {
    if (tile.buildingId !== "quarry") continue;
    if (isBuildingUnderConstruction(tile.constructionCompletesAt, now)) continue;
    quarryCount++;
  }
  return base + quarryMasonryBonusPerMinute(unlocked, quarryCount);
});

const displayedWood = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const stock = eco.stocks?.find((s) => s.resourceId === "wood");
  const amount = stock?.amount ?? eco.wood;
  const cap = stock?.cap ?? eco.woodCap;
  const last = stock?.lastCalculatedAt ?? eco.woodLastCalculatedAt;
  return projectedStock(amount, cap, last, liveWoodRate.value);
});

const woodCap = computed(() => {
  const eco = economy.value;
  if (!eco) return 200;
  return eco.stocks?.find((s) => s.resourceId === "wood")?.cap ?? eco.woodCap;
});

const displayedWheat = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const stock = eco.stocks?.find((s) => s.resourceId === "wheat");
  const amount = stock?.amount ?? eco.wheat;
  const cap = stock?.cap ?? eco.wheatCap;
  const last = stock?.lastCalculatedAt ?? eco.wheatLastCalculatedAt;
  return projectedStock(amount, cap, last, liveWheatRate.value);
});

const wheatCap = computed(() => {
  const eco = economy.value;
  if (!eco) return 200;
  return eco.stocks?.find((s) => s.resourceId === "wheat")?.cap ?? eco.wheatCap;
});

const displayedStone = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const stock = eco.stocks?.find((s) => s.resourceId === "stone");
  const amount = stock?.amount ?? eco.stone;
  const cap = stock?.cap ?? eco.stoneCap;
  const last = stock?.lastCalculatedAt ?? eco.stoneLastCalculatedAt;
  return projectedStock(amount, cap, last, liveStoneRate.value);
});

const stoneCap = computed(() => {
  const eco = economy.value;
  if (!eco) return 150;
  return eco.stocks?.find((s) => s.resourceId === "stone")?.cap ?? eco.stoneCap;
});

const displayedFood = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const stock = eco.stocks?.find((s) => s.resourceId === "food");
  const amount = stock?.amount ?? eco.food ?? 0;
  const cap = stock?.cap ?? eco.foodCap ?? 80;
  const last = stock?.lastCalculatedAt ?? eco.foodLastCalculatedAt;
  if (!last) return Math.floor(amount);
  const rate = eco.foodNetPerMinute ?? 0;
  if (rate >= 0) {
    return projectedStock(amount, cap, last, rate);
  }
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return Math.floor(amount);
  const minutes = Math.max(0, (nowTick.value - lastMs) / 60_000);
  return Math.max(0, amount + rate * minutes);
});

const foodCap = computed(() => {
  const eco = economy.value;
  if (!eco) return 80;
  return eco.stocks?.find((s) => s.resourceId === "food")?.cap ?? eco.foodCap ?? 80;
});

const displayedWorldshard = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const stock = eco.stocks?.find((s) => s.resourceId === "worldshard");
  if (!stock) return 0;
  const amount = stock.amount;
  const cap = stock.cap;
  if (amount >= cap - 1e-9) return Math.floor(cap);
  const last = Date.parse(stock.lastCalculatedAt);
  if (Number.isNaN(last) || TOWN_HALL_WORLDSHARD_INTERVAL_MS <= 0) {
    return Math.floor(amount);
  }
  const elapsed = Math.max(0, nowTick.value - last);
  const gained = Math.floor(elapsed / TOWN_HALL_WORLDSHARD_INTERVAL_MS);
  return Math.min(cap, Math.floor(amount) + gained);
});

const worldshardCap = computed(() => {
  const eco = economy.value;
  if (!eco) return 5;
  return eco.stocks?.find((s) => s.resourceId === "worldshard")?.cap ?? 5;
});

const worldshardRateLabel = computed(() => {
  const minutes = Math.max(1, Math.round(TOWN_HALL_WORLDSHARD_INTERVAL_MS / 60_000));
  return `1/${minutes}min`;
});

type StockFillLevel = "ok" | "near" | "full";

function stockFillLevel(amount: number, cap: number): StockFillLevel {
  if (cap <= 0) return "ok";
  const ratio = amount / cap;
  if (ratio >= 1 - 1e-9) return "full";
  if (ratio >= 0.7) return "near";
  return "ok";
}

function formatRatePerMinute(rate: number): string {
  if (rate <= 0) return "0/min";
  const rounded = Math.round(rate * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}/min` : `${rounded.toFixed(1)}/min`;
}

const woodStockUi = computed(() => {
  const amount = displayedWood.value;
  const cap = woodCap.value;
  const level = stockFillLevel(amount, cap);
  const rate = level === "full" ? "0/min" : formatRatePerMinute(liveWoodRate.value);
  return { amount, cap, level, rate };
});

const wheatStockUi = computed(() => {
  const amount = displayedWheat.value;
  const cap = wheatCap.value;
  const level = stockFillLevel(amount, cap);
  const rate = level === "full" ? "0/min" : formatRatePerMinute(liveWheatRate.value);
  return { amount, cap, level, rate };
});

const stoneStockUi = computed(() => {
  const amount = displayedStone.value;
  const cap = stoneCap.value;
  const level = stockFillLevel(amount, cap);
  const rate = level === "full" ? "0/min" : formatRatePerMinute(liveStoneRate.value);
  return { amount, cap, level, rate };
});

const foodStockUi = computed(() => {
  const amount = displayedFood.value;
  const cap = foodCap.value;
  const level = stockFillLevel(amount, cap);
  const eco = economy.value;
  // Food net still drives growth even when stock is capped — keep net visible unless full stock + positive net.
  let rate = "0/min";
  if (eco) {
    const net = eco.foodNetPerMinute ?? 0;
    if (level === "full" && net > 0) {
      rate = "0/min";
    } else if (net !== 0) {
      rate = formatRatePerMinute(net);
    }
  }
  return { amount, cap, level, rate };
});

const worldshardStockUi = computed(() => {
  const amount = displayedWorldshard.value;
  const cap = worldshardCap.value;
  const level = stockFillLevel(amount, cap);
  const rate = level === "full" ? "plein" : worldshardRateLabel.value;
  return { amount, cap, level, rate };
});

/** Un seul hint soft : priorité bois plein → dépenser (build). */
const stockSinkHint = computed(() => {
  if (woodStockUi.value.level !== "full") return null;
  return "Stock bois plein — construis un bâtiment";
});

const popGrowthLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return null;
  const required = eco.popGrowthSurplusRequired ?? 60;
  const base = eco.foodSurplusAccumulated ?? 0;
  const net = eco.foodNetPerMinute ?? 0;
  const last = eco.foodLastCalculatedAt;
  const atCap = eco.population >= populationCap.value;
  let projected = base;
  // Même au cap logements, on projette le remplissage (blé / surplus food).
  if (net > 0 && last) {
    const lastMs = Date.parse(last);
    if (!Number.isNaN(lastMs)) {
      const minutes = Math.max(0, (nowTick.value - lastMs) / 60_000);
      projected = base + Math.floor(net * minutes);
    }
  }
  projected = Math.min(required, Math.max(0, projected));
  if (atCap && projected >= required) return `${required}/${required}`;
  return `${projected}/${required}`;
});

const popGrowthPercent = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const required = eco.popGrowthSurplusRequired ?? 60;
  if (required <= 0) return 0;
  const label = popGrowthLabel.value;
  if (!label) return 0;
  const [a] = label.split("/").map(Number);
  return Math.min(100, Math.round(((a ?? 0) / required) * 100));
});

/**
 * idle — pas de surplus food (barre grise / vide)
 * growing — logements OK + food qui monte → vert
 * housing — cap pop (manque de maisons) → orange + icône maison barrée
 */
type PopGrowthTone = "idle" | "growing" | "housing";

const popGrowthTone = computed((): PopGrowthTone => {
  const eco = economy.value;
  if (!eco) return "idle";
  if (eco.population >= populationCap.value) return "housing";
  const net = eco.foodNetPerMinute ?? 0;
  if (net > 0 || popGrowthPercent.value > 0) return "growing";
  return "idle";
});

const popGrowthTitle = computed(() => {
  const eco = economy.value;
  if (!eco) return "";
  const label = popGrowthLabel.value;
  if (popGrowthTone.value === "housing") {
    return label
      ? `Surplus nourriture · ${label} · besoin de logements pour +1`
      : "Cap de population — construis des logements pour grandir";
  }
  if (popGrowthTone.value === "idle") {
    return "Croissance à l’arrêt — besoin d’un surplus de nourriture";
  }
  return `Prochain habitant · ${label}`;
});

const idlePop = computed(() => {
  const eco = economy.value;
  const tiles = world.value?.tiles;
  if (!eco || !tiles) return 0;
  return Math.max(0, eco.population - committedWorkersFromTiles(tiles));
});

const selectedWorldTile = computed(() => {
  const tile = selected.value;
  const tiles = world.value?.tiles;
  if (!tile || !tiles) return null;
  return tiles.find((entry) => entry.q === tile.q && entry.r === tile.r) ?? null;
});

const selectedConstruction = computed(() => {
  const snap = selectedWorldTile.value;
  const completesAt = snap?.constructionCompletesAt;
  const buildingId = snap?.buildingId;
  if (!buildingId || !completesAt) return null;
  if (
    buildingId !== "lumber_camp" &&
    buildingId !== "farm" &&
    buildingId !== "quarry" &&
    buildingId !== "fishing_hut" &&
    buildingId !== "house"
  ) {
    return null;
  }
  const endsAt = Date.parse(completesAt);
  if (Number.isNaN(endsAt)) return null;
  const remainingMs = Math.max(0, endsAt - nowTick.value);
  if (remainingMs <= 0) return null;
  const durationMs = import.meta.dev
    ? DEV_BUILD_DURATION_MS
    : BUILD_DURATION_MS[buildingId];
  const progress = Math.min(
    1,
    Math.max(0, 1 - remainingMs / Math.max(1, durationMs))
  );
  return {
    endsAt,
    remainingMs,
    progress,
    label: formatRemaining(remainingMs)
  };
});

function formatRemaining(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

type MapBadgeKind = "pop" | "workers" | "timer" | "bonus";

type MapBadge = {
  key: string;
  q: number;
  r: number;
  kind: MapBadgeKind;
  label: string;
  icon?: string;
  x: number;
  y: number;
  visible: boolean;
  /** Extracteur sans pop assignée. */
  needsWorkers?: boolean;
};

type DestroyFloatKind = "wood" | "workers";

type DestroyFloat = {
  id: number;
  kind: DestroyFloatKind;
  label: string;
  icon: string;
  x: number;
  y: number;
  /** Décalage horizontal relatif (stagger). */
  offsetX: number;
  delayMs: number;
};

const destroyFloats = ref<DestroyFloat[]>([]);
let destroyFloatSeq = 0;
const destroyFloatTimers = new Set<ReturnType<typeof setTimeout>>();

const overlayPositions = ref(
  new Map<string, { x: number; y: number; visible: boolean }>()
);

const START_VILLAGE = { q: 0, r: 0 } as const;

function workersForBuilding(
  tile: WorldTileSnapshot
): { count: number; max: number } | null {
  const buildingId = tile.buildingId;
  if (
    buildingId !== "lumber_camp" &&
    buildingId !== "farm" &&
    buildingId !== "quarry" &&
    buildingId !== "fishing_hut"
  ) {
    return null;
  }
  const assigned = tile.assignedWorkers ?? 0;
  return { count: assigned, max: WORKERS_PER_EXTRACTOR_L1 };
}

const mapBadges = computed((): MapBadge[] => {
  const tiles = world.value?.tiles;
  const eco = economy.value;
  if (!tiles?.length || !eco) return [];
  const now = nowTick.value;
  const out: MapBadge[] = [];

  const villageKey = `${START_VILLAGE.q},${START_VILLAGE.r}`;
  const villagePos = overlayPositions.value.get(villageKey);
  out.push({
    key: `pop:${villageKey}`,
    q: START_VILLAGE.q,
    r: START_VILLAGE.r,
    kind: "pop",
    /** Habitants libres / pop actuelle — pas le plafond de croissance (affiché dans le header). */
    label: `${idlePop.value}/${eco.population}`,
    icon: "i-lucide-users",
    x: villagePos?.x ?? -9999,
    y: villagePos?.y ?? -9999,
    visible: villagePos?.visible ?? false
  });

  for (const tile of tiles) {
    const key = `${tile.q},${tile.r}`;
    const pos = overlayPositions.value.get(key);

    if (isFusionBiome(tile.biome)) {
      const buildingId = tile.buildingId;
      const isProductionBuilding =
        buildingId == null ||
        buildingId === "lumber_camp" ||
        buildingId === "farm" ||
        buildingId === "quarry" ||
        buildingId === "fishing_hut";
      if (isProductionBuilding) {
        out.push({
          key: `bonus:${key}`,
          q: tile.q,
          r: tile.r,
          kind: "bonus",
          label: "+20%",
          x: pos?.x ?? -9999,
          y: pos?.y ?? -9999,
          visible: pos?.visible ?? false
        });
      }
    }

    if (!tile.buildingId) continue;

    const underConstruction = isBuildingUnderConstruction(
      tile.constructionCompletesAt,
      now
    );

    if (underConstruction && tile.constructionCompletesAt) {
      const ends = Date.parse(tile.constructionCompletesAt);
      if (!Number.isNaN(ends) && ends > now) {
        out.push({
          key: `timer:${key}`,
          q: tile.q,
          r: tile.r,
          kind: "timer",
          label: formatRemaining(ends - now),
          icon: "i-lucide-hammer",
          x: pos?.x ?? -9999,
          y: pos?.y ?? -9999,
          visible: pos?.visible ?? false
        });
      }
      continue;
    }

    const workers = workersForBuilding(tile);
    if (workers == null) continue;
    out.push({
      key: `workers:${key}`,
      q: tile.q,
      r: tile.r,
      kind: "workers",
      label: `${workers.count}/${workers.max}`,
      icon: "i-lucide-users",
      x: pos?.x ?? -9999,
      y: pos?.y ?? -9999,
      visible: pos?.visible ?? false,
      needsWorkers: workers.count === 0
    });
  }

  return out;
});

function collectOverlayTargets(): { q: number; r: number }[] {
  const tiles = world.value?.tiles;
  if (!tiles?.length) return [{ ...START_VILLAGE }];
  const targets: { q: number; r: number }[] = [{ ...START_VILLAGE }];
  const seen = new Set([`${START_VILLAGE.q},${START_VILLAGE.r}`]);
  for (const tile of tiles) {
    if (!tile.buildingId && !isFusionBiome(tile.biome)) {
      continue;
    }
    const key = `${tile.q},${tile.r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ q: tile.q, r: tile.r });
  }
  return targets;
}

function syncOverlayPositions() {
  const project = preview.value?.projectTile;
  if (!project || !world.value) {
    if (overlayPositions.value.size) overlayPositions.value = new Map();
    return;
  }
  const next = new Map<string, { x: number; y: number; visible: boolean }>();
  for (const target of collectOverlayTargets()) {
    const point = project(target.q, target.r);
    if (!point) continue;
    next.set(`${target.q},${target.r}`, {
      x: point.x,
      y: point.y,
      visible: point.visible
    });
  }
  overlayPositions.value = next;
}

function syncWheelAnchor() {
  if (!anyWheelOpen.value) {
    if (wheelAnchor.value !== null) wheelAnchor.value = null;
    return;
  }
  const tile = selected.value;
  const root = stage.value;
  const point = tile ? preview.value?.projectTile(tile.q, tile.r) : null;
  if (!tile || !point || !root) {
    if (wheelAnchor.value !== null) wheelAnchor.value = null;
    return;
  }
  const pad = 72;
  const w = root.clientWidth;
  const h = root.clientHeight;
  const x = Math.min(w - pad, Math.max(pad, point.x));
  const y = Math.min(h - pad, Math.max(pad, point.y));
  const prev = wheelAnchor.value;
  if (!prev || Math.abs(prev.x - x) > 0.25 || Math.abs(prev.y - y) > 0.25) {
    wheelAnchor.value = { x, y };
  }
}

function startOverlayLoop() {
  if (overlayRaf != null) return;
  const loop = () => {
    syncOverlayPositions();
    syncWheelAnchor();
    overlayRaf = requestAnimationFrame(loop);
  };
  overlayRaf = requestAnimationFrame(loop);
}

const activeConstructionCount = computed(
  () =>
    world.value?.tiles.filter((tile) => {
      const at = tile.constructionCompletesAt;
      if (!at) return false;
      const ends = Date.parse(at);
      return !Number.isNaN(ends) && ends > nowTick.value;
    }).length ?? 0
);

/** Refresh serveur à chaque chantier terminé (cap logements, +1 pop, libération ouvrier). */
watch(activeConstructionCount, (count, prev) => {
  if (prev !== undefined && count < prev) void refreshWorld();
});

const buildOptionsForWorldTile = (tile: WorldTileSnapshot) =>
  listBuildOptionsForTile({
    biome: tile.biome,
    hasVillage: tile.q === 0 && tile.r === 0,
    existingBuildingId: tile.buildingId ?? null,
    poiId: tile.poiId ?? null,
    unlockedTechIds: world.value?.research.unlockedTechIds ?? ["foundations"]
  });

const constructionCatalog = computed(() => {
  const unlockedTechIds = world.value?.research.unlockedTechIds ?? ["foundations"];
  const hasWood = (cost: number) => displayedWood.value + 1e-9 >= cost;
  const hasIdlePop = idlePop.value + 1e-9 >= BUILD_IDLE_POP_REQUIREMENT;
  return listPlaceableBuildings().map((def) => {
    const id = def.id as PlaceableBuildingId;
    const woodCost = BUILD_COST_WOOD[id] ?? def.woodCost ?? 0;
    const ui = buildingUi(id);
    const isUnlocked = isBuildingUnlocked(id, unlockedTechIds);
    const requiredTechId = buildingRequiredTech(id);
    const requiredTechLabel = requiredTechId
      ? getTechNode(requiredTechId).label
      : null;
    const canAffordWood = hasWood(woodCost);
    const canAfford = isUnlocked && canAffordWood && hasIdlePop;
    return {
      id,
      ...ui,
      woodCost,
      isUnlocked,
      requiredTechLabel,
      canAffordWood,
      hasIdlePop,
      canAfford,
      active: constructionMode.value === id
    };
  });
});

const validConstructionTiles = computed(() => {
  const buildingId = constructionMode.value;
  const tiles = world.value?.tiles;
  if (!buildingId || !tiles) return [] as HexCoord[];
  const out: HexCoord[] = [];
  for (const tile of tiles) {
    if (buildOptionsForWorldTile(tile).includes(buildingId)) {
      out.push({ q: tile.q, r: tile.r });
    }
  }
  return out;
});

const invalidConstructionTiles = computed(() => {
  const buildingId = constructionMode.value;
  const tiles = world.value?.tiles;
  if (!buildingId || !tiles) return [] as HexCoord[];
  const validKeys = new Set(
    validConstructionTiles.value.map((cell) => `${cell.q},${cell.r}`)
  );
  const out: HexCoord[] = [];
  for (const tile of tiles) {
    const key = `${tile.q},${tile.r}`;
    if (!validKeys.has(key)) {
      out.push({ q: tile.q, r: tile.r });
    }
  }
  return out;
});

type WorkerPanel = {
  title: string;
  hint: string;
  count: number;
  max: number;
  rateLabel: string;
  canAdd: boolean;
  canRemove: boolean;
};

const selectedWorkerPanel = computed((): WorkerPanel | null => {
  const tile = selectedWorldTile.value;
  const eco = economy.value;
  if (!tile?.buildingId || !eco) return null;
  if (selectedConstruction.value) return null;

  const assigned = tile.assignedWorkers ?? 0;
  const max = WORKERS_PER_EXTRACTOR_L1;
  const mult = tileProductionMultiplier(tile.biome);

  if (tile.buildingId === "lumber_camp") {
    const stockFull = woodStockUi.value.level === "full";
    return {
      title: "Bûcheron",
      hint: stockFull
        ? "Stock bois plein — construis pour libérer de la place."
        : "Assigne un habitant du village pour produire du bois sur ce camp.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0 && !stockFull
          ? formatRatePerMinute(assigned * WOOD_RATE_PER_WORKER_PER_MINUTE * mult)
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  if (tile.buildingId === "farm") {
    const stockFull = wheatStockUi.value.level === "full";
    return {
      title: "Fermier",
      hint: stockFull
        ? "Stock blé plein — transforme ou dépense pour libérer de la place."
        : "Assigne un habitant du village pour produire du blé sur cette ferme.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0 && !stockFull
          ? formatRatePerMinute(assigned * WHEAT_RATE_PER_WORKER_PER_MINUTE * mult)
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  if (tile.buildingId === "quarry") {
    const stockFull = stoneStockUi.value.level === "full";
    return {
      title: "Carrier",
      hint: stockFull
        ? "Stock pierre plein — construis pour libérer de la place."
        : "Assigne un habitant du village pour produire de la pierre sur cette carrière.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0 && !stockFull
          ? formatRatePerMinute(assigned * STONE_RATE_PER_WORKER_PER_MINUTE * mult)
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  if (tile.buildingId === "fishing_hut") {
    const stockFull = foodStockUi.value.level === "full";
    return {
      title: "Pêcheur",
      hint: stockFull
        ? "Stock nourriture plein — la pêche attend."
        : "Assigne un habitant pour pêcher sur ce banc de poisson.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0 && !stockFull
          ? formatRatePerMinute(
              assigned * FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE * mult
            )
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  return null;
});

const buildingLabel = (id: BuildingId | null | undefined) => {
  if (!id) return null;
  return buildings.find((entry) => entry.id === id)?.label ?? id;
};

const biomeSwatch: Record<BiomeId, string> = {
  forest: "#62c46f",
  plains: "#8fce6e",
  mountain: "#d0d7e2",
  water: "#62bfe8",
  forest_plains: "#a8c45e",
  plains_mountain: "#c4b894",
  forest_mountain: "#7a9a7e"
};

const biomeIcon: Record<BiomeId, string> = {
  forest: "i-lucide-trees",
  plains: "i-lucide-sprout",
  mountain: "i-lucide-mountain",
  water: "i-lucide-waves",
  forest_plains: "i-lucide-leaf",
  plains_mountain: "i-lucide-mountain-snow",
  forest_mountain: "i-lucide-tree-pine"
};

const showBiomeWheel = computed(
  () =>
    selected.value != null &&
    selected.value.canGenerate &&
    selected.value.biome == null &&
    !expanding.value &&
    !building.value &&
    !debugBiomeOpen.value
);

const regionExpansionCost = computed(() => {
  const tile = selected.value;
  const tiles = world.value?.tiles;
  if (!tile?.canGenerate || tile.biome != null || !tiles) return null;
  return computeRegionExpansionCost({
    center: { q: tile.q, r: tile.r },
    tiles,
    now: nowTick.value
  });
});

const canAffordRegion = computed(() => {
  const cost = regionExpansionCost.value;
  if (!cost) return false;
  return displayedWorldshard.value + 1e-9 >= cost.worldshards;
});

const regionCostLabel = computed(() => {
  const cost = regionExpansionCost.value;
  if (!cost) return "";
  const n = cost.worldshards;
  return n === 1 ? "1 éclat" : `${n} éclats`;
});

/** Bottom sheet : bâtiment, village, ou tuile biome (sans bâtiment). */
const showBuildingSheet = computed(() => {
  const tile = selected.value;
  if (!tile || debugBiomeOpen.value) return false;
  if (tile.hasVillage || tile.buildingId != null) return true;
  return tile.biome != null;
});

/** Construction ouverte en même temps qu’une fiche bas — empiler au-dessus. */
const constructionSheetRaised = computed(
  () => constructionMenuOpen.value && showBuildingSheet.value
);

/** Tuile biome libre (pas de bâtiment / village) — panneau d’info. */
const showTileInfoSheet = computed(() => {
  const tile = selected.value;
  return Boolean(
    showBuildingSheet.value &&
      tile?.biome &&
      !tile.hasVillage &&
      !tile.buildingId
  );
});

const selectedTileBiomeInfo = computed(() => {
  const tile = selected.value;
  if (!tile?.biome) return null;
  return getBiomeDefinition(tile.biome) ?? null;
});

const selectedTilePoiInfo = computed(() => {
  if (!showTileInfoSheet.value) return null;
  const poiId = selectedWorldTile.value?.poiId;
  if (!poiId) return null;
  return getPoiDefinition(poiId) ?? null;
});

/** Hub debug (bug) quand la tuile a un biome mais pas de sheet / roue biome. */
const showDebugHub = computed(
  () =>
    isDevClient &&
    selected.value?.biome != null &&
    !showBuildingSheet.value &&
    !showBiomeWheel.value &&
    !debugBiomeOpen.value &&
    !expanding.value &&
    !building.value &&
    !settingBiome.value
);

const showDebugBiomeWheel = computed(
  () =>
    isDevClient &&
    debugBiomeOpen.value &&
    selected.value?.biome != null &&
    !expanding.value &&
    !building.value
);

const showDebugBugOnSheet = computed(
  () => isDevClient && showBuildingSheet.value
);

const selectedBuildingTitle = computed(() => {
  const tile = selected.value;
  if (!tile) return "";
  if (tile.hasVillage) return "Village";
  if (tile.buildingId) return buildingLabel(tile.buildingId) ?? "Bâtiment";
  return selectedTileBiomeInfo.value?.label ?? "Tuile";
});

const canDestroySelectedBuilding = computed(() => {
  const tile = selected.value;
  return Boolean(tile?.buildingId && !tile.hasVillage);
});

/** Aperçu remboursement (avant appel API) pour le dialogue de confirmation. */
const destroyRefundPreview = computed(() => {
  const tile = selectedWorldTile.value;
  if (!tile?.buildingId) return { wood: 0, workers: 0 };
  const underConstruction = isBuildingUnderConstruction(
    tile.constructionCompletesAt,
    nowTick.value
  );
  return {
    wood: woodRefundOnDestroy(tile.buildingId, underConstruction),
    workers: tile.assignedWorkers ?? 0
  };
});

function spawnDestroyFloats(
  q: number,
  r: number,
  refunds: { wood: number; workers: number },
  origin?: { x: number; y: number } | null
) {
  const point =
    origin ??
    preview.value?.projectTile(q, r) ??
    overlayPositions.value.get(`${q},${r}`) ??
    null;
  if (!point) return;

  const chips: Omit<DestroyFloat, "id">[] = [];
  if (refunds.wood > 0) {
    chips.push({
      kind: "wood",
      label: `+${Math.floor(refunds.wood)}`,
      icon: "i-lucide-tree-pine",
      x: point.x,
      y: point.y,
      offsetX: 0,
      delayMs: 0
    });
  }
  if (refunds.workers > 0) {
    chips.push({
      kind: "workers",
      label: `+${refunds.workers}`,
      icon: "i-lucide-users",
      x: point.x,
      y: point.y,
      offsetX: chips.length === 0 ? 0 : 20,
      delayMs: chips.length === 0 ? 0 : 90
    });
  }
  if (chips.length === 0) return;

  // Décale le premier chip si les deux sont présents.
  if (chips.length === 2) chips[0]!.offsetX = -20;

  const spawned: DestroyFloat[] = chips.map((chip) => ({
    ...chip,
    id: ++destroyFloatSeq
  }));
  destroyFloats.value = [...destroyFloats.value, ...spawned];

  for (const chip of spawned) {
    const timer = setTimeout(() => {
      destroyFloats.value = destroyFloats.value.filter((f) => f.id !== chip.id);
      destroyFloatTimers.delete(timer);
    }, 1400 + chip.delayMs);
    destroyFloatTimers.add(timer);
  }
}

const anyWheelOpen = computed(
  () =>
    showBiomeWheel.value ||
    showDebugHub.value ||
    showDebugBiomeWheel.value
);

watch(anyWheelOpen, (show) => {
  if (wheelReadyTimer) {
    clearTimeout(wheelReadyTimer);
    wheelReadyTimer = null;
  }
  if (!show) {
    wheelInteractive.value = false;
    return;
  }
  wheelInteractive.value = false;
  wheelReadyTimer = setTimeout(() => {
    wheelInteractive.value = true;
    wheelReadyTimer = null;
  }, 450);
});

const wheelStyle = computed(() => {
  const anchor = wheelAnchor.value;
  if (!anchor) return { left: "50%", top: "50%" };
  return { left: `${anchor.x}px`, top: `${anchor.y}px` };
});

const BIOME_WHEEL_RADIUS = 56;
const DEBUG_BIOME_WHEEL_RADIUS = 72;

const wheelSlots = computed(() => {
  const n = primaryBiomes.length;
  const radius = BIOME_WHEEL_RADIUS;
  // Arc inférieur (droite → bas → gauche), coût réservé à la moitié haute.
  return primaryBiomes.map((biome, index) => {
    const angle =
      n <= 1 ? Math.PI / 2 : (index * Math.PI) / (n - 1);
    return {
      biome,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

const debugBiomeWheelSlots = computed(() => {
  const n = biomes.length;
  const radius = DEBUG_BIOME_WHEEL_RADIUS;
  // Cercle avec trou en bas pour l’icône debug.
  const gap = (2 * Math.PI) / (n + 1);
  const start = Math.PI / 2 + gap;
  return biomes.map((biome, index) => {
    const angle = start + index * gap;
    return {
      biome,
      active: selected.value?.biome === biome.id,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

/** Toujours en bas de la roue (hub, build, debug biomes). */
const debugBugButtonStyle = {
  transform: `translate(-50%, -50%) translate(0px, ${BIOME_WHEEL_RADIUS}px)`
};

const debugBugOnBiomeStyle = {
  transform: `translate(-50%, -50%) translate(0px, ${DEBUG_BIOME_WHEEL_RADIUS}px)`
};

const regionCostStyle = {
  transform: `translate(-50%, -50%) translate(0px, ${-BIOME_WHEEL_RADIUS}px)`
};

const cancelButtonStyle = {
  transform: "translate(-50%, -50%)"
};

const buildingSheet = useTemplateRef<HTMLElement>("buildingSheet");
const constructionBarRef = useTemplateRef<HTMLElement>("constructionBar");
const wheelRoot = useTemplateRef<HTMLElement>("wheelRoot");

function cancelConstructionMode() {
  constructionMode.value = null;
  preview.value?.setBuildHighlights([], []);
}

function closeConstructionMenu() {
  constructionMenuOpen.value = false;
  cancelConstructionMode();
}

function openConstructionMenu() {
  clearSelection();
  constructionMenuOpen.value = true;
}

function toggleConstructionMenu() {
  if (constructionMenuOpen.value) {
    closeConstructionMenu();
  } else {
    openConstructionMenu();
  }
}

async function toggleDeviceTiltFromSettings() {
  await toggleDeviceTilt();
}

function selectConstruction(id: PlaceableBuildingId) {
  const entry = constructionCatalog.value.find((item) => item.id === id);
  if (!entry?.isUnlocked) {
    expandError.value = entry?.requiredTechLabel
      ? `Débloque la tech « ${entry.requiredTechLabel} » pour construire.`
      : "Bâtiment verrouillé par la recherche.";
    return;
  }
  if (!entry?.canAfford) {
    if (!entry.canAffordWood) {
      expandError.value = `Pas assez de bois (${entry.woodCost} requis).`;
    } else {
      expandError.value = "Pas assez de pop libre (1 requis).";
    }
    return;
  }
  if (constructionMode.value === id) {
    cancelConstructionMode();
    return;
  }
  constructionMode.value = id;
  expandError.value = null;
  clearSelection();
  tutorialOnConstructionSelected(id);
}

function onStagePointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch" || !anyWheelOpen.value) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (wheelRoot.value?.contains(target)) return;
  if (buildingSheet.value?.contains(target)) return;
  if (constructionBarRef.value?.contains(target)) return;
  if (target instanceof HTMLCanvasElement) return;
  clearSelection();
}

function onSelect(tile: SelectedTile | null) {
  if (
    (expanding.value || building.value || settingBiome.value || destroying.value) &&
    tile != null
  ) {
    return;
  }

  if (constructionMode.value && tile?.biome) {
    const valid = validConstructionTiles.value.some(
      (entry) => entry.q === tile.q && entry.r === tile.r
    );
    if (valid) {
      void placeBuildingAt(constructionMode.value, tile);
      return;
    }
    expandError.value = "Impossible de construire ici.";
    return;
  }

  debugBiomeOpen.value = false;
  destroyConfirm.value = false;
  if (tile != null) {
    closeConstructionMenu();
  }
  selected.value = tile;
  expandError.value = null;
  if (tile) {
    tutorialOnTileSelected({
      biome: tile.biome,
      canGenerate: tile.canGenerate
    });
  }
}

function clearSelection() {
  selected.value = null;
  debugBiomeOpen.value = false;
  destroyConfirm.value = false;
  preview.value?.clearSelection();
}

function openDebugBiomeWheel() {
  if (!isDevClient || !selected.value?.biome) return;
  debugBiomeOpen.value = true;
}

function closeDebugBiomeWheel() {
  debugBiomeOpen.value = false;
}

async function applyDebugBiome(biome: BiomeId) {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile?.biome || !id || settingBiome.value) return;
  if (tile.biome === biome && !tile.buildingId) {
    debugBiomeOpen.value = false;
    return;
  }

  settingBiome.value = true;
  expandError.value = null;
  try {
    const snapshot = await setTileBiomeDev(id, { q: tile.q, r: tile.r }, biome);
    if (!snapshot) {
      expandError.value = worldError.value ?? "Impossible de changer le biome.";
      return;
    }
    preview.value?.applyTileBiome(tile.q, tile.r, biome);
    debugBiomeOpen.value = false;
    // Resync sélection depuis la scène (payload déjà émis par applyTileBiome).
  } finally {
    settingBiome.value = false;
  }
}

async function generate(biome: PrimaryBiomeId) {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile || tile.biome || !tile.canGenerate || !id || expanding.value) return;
  if (!canAffordRegion.value) {
    expandError.value = "Pas assez d’éclats de monde pour étendre.";
    return;
  }

  expanding.value = true;
  expandError.value = null;
  const center = { q: tile.q, r: tile.r };

  try {
    const result = await expandRegion(id, center, biome);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible d’étendre le monde.";
      return;
    }
    preview.value?.applyRegion(result.center, result.biome, result.tiles);
    tutorialOnRegionCreated(result.biome);
    clearSelection();
  } finally {
    expanding.value = false;
  }
}

async function placeBuildingAt(buildingId: PlaceableBuildingId, tile: SelectedTile) {
  const id = world.value?.id;
  if (!tile?.biome || !id || building.value) return;
  const unlockedTechIds = world.value?.research.unlockedTechIds ?? ["foundations"];
  if (!isBuildingUnlocked(buildingId, unlockedTechIds)) {
    const requiredTechId = buildingRequiredTech(buildingId);
    expandError.value = requiredTechId
      ? `Débloque la tech « ${getTechNode(requiredTechId).label} » pour construire.`
      : "Bâtiment verrouillé par la recherche.";
    return;
  }
  const cost = BUILD_COST_WOOD[buildingId];
  if (displayedWood.value + 1e-9 < cost) {
    expandError.value = `Pas assez de bois (${cost} requis).`;
    return;
  }
  if (idlePop.value < BUILD_IDLE_POP_REQUIREMENT) {
    expandError.value = "Pas assez de pop libre (1 requis).";
    return;
  }

  building.value = true;
  expandError.value = null;
  const origin = { q: tile.q, r: tile.r };

  try {
    const result = await buildBuilding(id, buildingId, origin);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible de construire.";
      return;
    }
    preview.value?.applyBuilding(result.tile.q, result.tile.r, buildingId);
    tutorialOnBuildingPlaced(buildingId);
    cancelConstructionMode();
    selected.value = {
      ...tile,
      buildingId,
      clientX: tile.clientX,
      clientY: tile.clientY
    };
  } finally {
    building.value = false;
  }
}

async function setWorkers(count: number) {
  const id = world.value?.id;
  const tile = selected.value;
  if (!id || !tile || assigning.value) return;
  assigning.value = true;
  expandError.value = null;
  try {
    const result = await assignWorkers(id, { q: tile.q, r: tile.r }, count);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible d’assigner.";
    }
  } finally {
    assigning.value = false;
  }
}

function askDestroyBuilding() {
  if (!canDestroySelectedBuilding.value || destroying.value) return;
  destroyConfirm.value = true;
}

function cancelDestroyBuilding() {
  destroyConfirm.value = false;
}

async function confirmDestroyBuilding() {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile?.buildingId || tile.hasVillage || !id || destroying.value) return;

  const q = tile.q;
  const r = tile.r;
  const originPoint =
    preview.value?.projectTile(q, r) ??
    overlayPositions.value.get(`${q},${r}`) ??
    null;

  destroying.value = true;
  expandError.value = null;
  try {
    const result = await destroyBuilding(id, { q, r });
    if (!result) {
      expandError.value = worldError.value ?? "Impossible de détruire le bâtiment.";
      return;
    }
    spawnDestroyFloats(q, r, result.refunds ?? { wood: 0, workers: 0 }, originPoint);
    preview.value?.removeBuilding(q, r);
    destroyConfirm.value = false;
    clearSelection();
  } finally {
    destroying.value = false;
  }
}

async function onResetWorld() {
  const id = world.value?.id;
  if (!isDevClient || !id || resetting.value) return;
  resetting.value = true;
  expandError.value = null;
  clearSelection();
  try {
    const snapshot = await resetWorld(id);
    if (!snapshot) {
      expandError.value = worldError.value ?? "Impossible de reset le monde.";
    }
  } finally {
    resetting.value = false;
  }
}

async function onGrantResources() {
  const id = world.value?.id;
  if (!isDevClient || !id || granting.value) return;
  granting.value = true;
  expandError.value = null;
  try {
    const snapshot = await grantDevResources(id);
    if (!snapshot) {
      expandError.value =
        worldError.value ?? "Impossible d’ajouter des ressources.";
    }
  } finally {
    granting.value = false;
  }
}

function formatStock(value: number) {
  return Math.floor(value).toLocaleString("fr-FR");
}

function stageRect(): DOMRect | null {
  return stage.value?.getBoundingClientRect() ?? null;
}

function holeFromElement(
  el: Element | null,
  options?: {
    visualPad?: number;
    hitPad?: number;
    radius?: number;
    mode?: "spotlight" | "pulse";
  }
): TutorialHole | null {
  const stageBox = stageRect();
  if (!el || !stageBox) return null;
  const box = el.getBoundingClientRect();
  const visualPad = options?.visualPad ?? 10;
  const hitPad = options?.hitPad ?? 2;
  const vx = box.left - stageBox.left - visualPad;
  const vy = box.top - stageBox.top - visualPad;
  const vw = box.width + visualPad * 2;
  const vh = box.height + visualPad * 2;
  const hx = box.left - stageBox.left - hitPad;
  const hy = box.top - stageBox.top - hitPad;
  const hw = box.width + hitPad * 2;
  const hh = box.height + hitPad * 2;
  return {
    x: vx,
    y: vy,
    w: vw,
    h: vh,
    radius:
      options?.radius ??
      Math.min(28, Math.max(14, Math.min(vw, vh) / 2)),
    mode: options?.mode ?? "spotlight",
    hit: { x: hx, y: hy, w: hw, h: hh }
  };
}

const tutorialExpandTargets = computed(() => {
  const snap = world.value;
  if (!snap) return [] as { q: number; r: number }[];
  const centers = snap.regions.map((region) => ({
    q: region.center.q,
    r: region.center.r
  }));
  const biomesMap = new Map(
    snap.tiles.map((tile) => [`${tile.q},${tile.r}`, tile.biome] as const)
  );
  return adjacentRegionCenters(centers).filter((center) =>
    canPlaceRegion(biomesMap, center, centers)
  );
});

const tutorialStageSize = computed(() => {
  void tutorialHoleTick.value;
  const box = stageRect();
  return {
    width: box?.width ?? 0,
    height: box?.height ?? 0
  };
});

/** Spotlight UI uniquement (header / boutons roue). Null = étape carte libre. */
const tutorialHole = computed((): TutorialHole | null => {
  void tutorialHoleTick.value;
  if (!tutorialActive.value || !tutorialStep.value) return null;
  const target = tutorialStep.value.target;

  if (target === "header") {
    return holeFromElement(
      stage.value?.querySelector('[data-tutorial="header"]') ?? null,
      { visualPad: 14, hitPad: 14, radius: 24, mode: "spotlight" }
    );
  }
  if (target === "build-lumber") {
    const btn = stage.value?.querySelector(
      '[data-tutorial="build-lumber_camp"]'
    );
    if (!btn) return null;
    return holeFromElement(btn, {
      visualPad: 4,
      hitPad: 2,
      radius: 999,
      mode: "spotlight"
    });
  }
  if (target === "biome-plains") {
    const btn = stage.value?.querySelector('[data-tutorial="biome-plains"]');
    if (!btn) return null;
    return holeFromElement(btn, {
      visualPad: 4,
      hitPad: 2,
      radius: 999,
      mode: "spotlight"
    });
  }
  return null;
});

/** Coords tuiles à surligner dans la scène 3D (pas de cercle DOM). */
const tutorialHighlightCoords = computed(() => {
  if (!tutorialActive.value || !tutorialStep.value || constructionMode.value) {
    return [] as HexCoord[];
  }
  const target = tutorialStep.value.target;

  if (target === "map-expand") return tutorialExpandTargets.value;
  if (target === "biome-plains" && !tutorialHole.value) {
    return tutorialExpandTargets.value;
  }
  return [];
});

/** Étape carte : pas de blockers (caméra libre). */
const tutorialLockMap = computed(() => Boolean(tutorialHole.value));

watch(
  [validConstructionTiles, invalidConstructionTiles, constructionMode],
  ([valid, invalid, mode]) => {
    if (mode) {
      preview.value?.setBuildHighlights(valid, invalid);
      preview.value?.setTutorialHighlights([]);
      return;
    }
    preview.value?.setBuildHighlights([], []);
  },
  { flush: "post" }
);

watch(
  tutorialHighlightCoords,
  (coords) => {
    if (constructionMode.value) return;
    preview.value?.setTutorialHighlights(coords);
  },
  { flush: "post" }
);

watch(tutorialActive, (on) => {
  if (!on) {
    preview.value?.setTutorialHighlights([]);
    preview.value?.setBuildHighlights([], []);
  }
});

watch(constructionMode, (mode) => {
  if (!mode) return;
  preview.value?.setTutorialHighlights([]);
});

watch(
  () => tutorialStep.value?.id,
  (stepId) => {
    if (stepId === "place-lumber") {
      clearSelection();
      constructionMenuOpen.value = true;
    }
  }
);

watch(
  () => world.value?.id,
  (id) => {
    if (id) window.setTimeout(() => startTutorial(), 700);
  }
);
</script>

<template>
  <AdsDevSideRails v-if="isDevClient" />
  <AdsDevMobileAnchor v-if="isDevClient" />
  <div
    ref="stage"
    class="game-shell relative h-dvh overflow-hidden bg-[#dfe8e4]"
    :class="{
      'game-shell--full': hasNoAds,
      'game-shell--construction-bar': world,
      'game-shell--construction-bar-collapsed': world && !constructionMenuOpen,
      'game-shell--tech-bar': world,
      'game-shell--tech-bar-collapsed': world && !techTimelineOpen,
      'game-shell--building-sheet': showBuildingSheet
    }"
    @pointerdown.capture="onStagePointerDown"
  >
    <div
      v-if="!world"
      class="absolute inset-0 z-50 flex items-center justify-center bg-[#dfe8e4] p-6 text-center"
    >
      <div class="max-w-sm rounded-2xl border border-[#1c2b28]/10 bg-white/75 p-6 text-[#1c2b28] shadow-[0_12px_40px_rgb(28_43_40_/_0.08)] backdrop-blur-md">
        <p class="font-display text-sm font-medium tracking-[0.18em] text-[#4a7c6f] uppercase">
          Hexald
        </p>
        <p class="mt-3 text-sm text-[#3d524c]">
          {{ worldError ?? "Impossible de charger ton monde." }}
        </p>
        <NuxtLink
          to="/"
          class="mt-5 inline-flex rounded-full border border-[#1c2b28]/12 bg-white/70 px-4 py-2 text-sm text-[#2d5248] transition hover:border-[#4a7c6f]/40 hover:text-[#1c2b28]"
        >
          Retour
        </NuxtLink>
      </div>
    </div>

    <div v-else class="absolute inset-0 z-0">
      <HexPreview
        :key="world.id"
        ref="preview"
        class="size-full"
        :initial-world="world"
        @select="onSelect"
      />
    </div>

    <div
      v-for="badge in mapBadges"
      v-show="badge.visible"
      :key="badge.key"
      class="map-badge pointer-events-none absolute z-20"
      :class="[
        `map-badge--${badge.kind}`,
        badge.needsWorkers ? 'map-badge--needs-workers' : null
      ]"
      :style="{ left: `${badge.x}px`, top: `${badge.y}px` }"
      aria-hidden="true"
    >
      <span class="map-badge__chip">
        <UIcon v-if="badge.icon" :name="badge.icon" class="map-badge__icon" />
        {{ badge.label }}
        <span v-if="badge.needsWorkers" class="map-badge__alert">!</span>
      </span>
    </div>

    <div
      v-for="floater in destroyFloats"
      :key="floater.id"
      class="destroy-float pointer-events-none absolute z-40"
      :class="`destroy-float--${floater.kind}`"
      :style="{
        left: `${floater.x}px`,
        top: `${floater.y}px`,
        '--float-x': `${floater.offsetX}px`,
        animationDelay: `${floater.delayMs}ms`
      }"
      aria-hidden="true"
    >
      <span class="destroy-float__chip">
        <UIcon :name="floater.icon" class="destroy-float__icon" />
        {{ floater.label }}
      </span>
    </div>

    <header
      v-if="world"
      data-tutorial="header"
      class="play-cloud-header pointer-events-none absolute inset-x-0 top-0 z-50"
    >
      <div class="play-cloud-header__sky" aria-hidden="true">
        <svg
          class="play-cloud-header__svg"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="play-cloud-fill" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97" />
              <stop offset="55%" stop-color="#f4f8f5" stop-opacity="0.92" />
              <stop offset="100%" stop-color="#e4eee8" stop-opacity="0.72" />
            </linearGradient>
            <filter id="play-cloud-soft" x="-5%" y="-30%" width="110%" height="170%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>
          <path
            fill="url(#play-cloud-fill)"
            filter="url(#play-cloud-soft)"
            d="M0 0H1200V70
              C1120 70 1060 92 980 88
              C880 83 820 108 720 102
              C620 96 560 118 460 110
              C360 102 300 122 210 112
              C130 104 70 92 0 84
              Z"
          />
        </svg>
        <div class="play-cloud-header__puff play-cloud-header__puff--1" />
        <div class="play-cloud-header__puff play-cloud-header__puff--2" />
        <div class="play-cloud-header__puff play-cloud-header__puff--3" />
        <div class="play-cloud-header__puff play-cloud-header__puff--4" />
      </div>

      <div class="play-cloud-header__content pointer-events-auto">
        <div class="play-cloud-header__identity">
          <div class="play-cloud-header__identity-top">
            <div
              class="play-cloud-header__avatar"
              aria-hidden="true"
              title="Avatar"
            />
            <div class="play-cloud-header__identity-text min-w-0">
              <p class="play-cloud-header__name truncate">
                {{ pseudo ?? "…" }}
              </p>
              <p class="play-cloud-header__world truncate">
                {{ worldName }}
              </p>
            </div>
          </div>
          <div
            v-if="economy"
            class="play-cloud-header__pop-row"
            :title="`Population ${population}/${populationCap}`"
          >
            <p class="play-cloud-header__stat play-cloud-header__stat--pop">
              <UIcon name="i-lucide-users" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Population</span>
              {{ population }}/{{ populationCap }}
            </p>
            <div
              class="play-cloud-header__growth"
              :class="`play-cloud-header__growth--${popGrowthTone}`"
              :title="popGrowthTitle"
            >
              <div class="play-cloud-header__growth-track">
                <div
                  class="play-cloud-header__growth-fill"
                  :style="{ width: `${popGrowthPercent}%` }"
                />
              </div>
              <span class="play-cloud-header__growth-next">
                +1
                <UIcon name="i-lucide-users" class="play-cloud-header__growth-next-icon" aria-hidden="true" />
                <span
                  v-if="popGrowthTone === 'housing'"
                  class="play-cloud-header__growth-housing"
                  aria-label="Manque de logements"
                >
                  <UIcon name="i-lucide-house" class="play-cloud-header__growth-housing-icon" aria-hidden="true" />
                </span>
              </span>
            </div>
          </div>
        </div>

        <div class="play-cloud-header__end">
          <nav class="play-top-actions" aria-label="Raccourcis">
            <NuxtLink
              to="/news"
              class="play-top-actions__btn"
              title="Actualités"
              aria-label="Actualités"
            >
              <UIcon name="i-lucide-newspaper" class="play-top-actions__icon" />
            </NuxtLink>
            <div ref="settingsRoot" class="play-settings">
              <button
                type="button"
                class="play-top-actions__btn"
                :class="{ 'play-top-actions__btn--active': settingsOpen }"
                title="Réglages"
                aria-label="Réglages"
                aria-haspopup="menu"
                :aria-expanded="settingsOpen"
                @click="toggleSettings"
              >
                <UIcon name="i-lucide-settings" class="play-top-actions__icon" />
              </button>
              <div
                v-if="settingsOpen"
                class="play-settings__menu"
                role="menu"
                aria-label="Réglages"
              >
                <ClientOnly>
                  <button
                    v-if="isGuest"
                    type="button"
                    class="play-settings__item"
                    role="menuitem"
                    @click="openLinkAccountFromSettings"
                  >
                    <UIcon name="i-lucide-cloud-upload" class="play-settings__item-icon" aria-hidden="true" />
                    <span>Lier mon compte</span>
                  </button>
                </ClientOnly>
                <button
                  type="button"
                  class="play-settings__item"
                  role="menuitemcheckbox"
                  :aria-checked="tiltEnabled"
                  @click="toggleDeviceTiltFromSettings"
                >
                  <UIcon name="i-lucide-smartphone" class="play-settings__item-icon" aria-hidden="true" />
                  <span>Parallax (gyro)</span>
                  <span class="play-settings__item-meta">
                    {{ tiltEnabled ? "Activé" : "Désactivé" }}
                  </span>
                </button>
                <button
                  type="button"
                  class="play-settings__item"
                  role="menuitem"
                  @click="openNotificationSettingsFromSettings"
                >
                  <UIcon name="i-lucide-bell" class="play-settings__item-icon" aria-hidden="true" />
                  <span>Notifications</span>
                  <span class="play-settings__item-meta">
                    {{ notificationEnabledCount }}/{{ notificationTotalCount }}
                  </span>
                </button>
                <button
                  type="button"
                  class="play-settings__item"
                  role="menuitem"
                  @click="openSupportFromSettings"
                >
                  <UIcon name="i-lucide-message-circle" class="play-settings__item-icon" aria-hidden="true" />
                  <span>Aide & contact</span>
                </button>
                <button
                  type="button"
                  class="play-settings__item play-settings__item--danger"
                  role="menuitem"
                  :disabled="disconnecting"
                  @click="askDisconnect"
                >
                  <UIcon name="i-lucide-log-out" class="play-settings__item-icon" aria-hidden="true" />
                  <span>{{ disconnecting ? "Déconnexion…" : "Se déconnecter" }}</span>
                </button>
              </div>
            </div>
          </nav>

          <div
            v-if="economy"
            class="play-cloud-header__resources"
            aria-label="Ressources de base"
          >
            <p
              class="play-cloud-header__stat"
              :class="`play-cloud-header__stat--${worldshardStockUi.level}`"
              :title="`Éclat de monde ${formatStock(worldshardStockUi.amount)}/${formatStock(worldshardStockUi.cap)} · hôtel de ville`"
            >
              <UIcon name="i-lucide-sparkles" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Éclat de monde</span>
              <span class="play-cloud-header__stock">
                {{ formatStock(worldshardStockUi.amount) }}<span class="play-cloud-header__cap">/{{ formatStock(worldshardStockUi.cap) }}</span>
              </span>
              <span class="play-cloud-header__rate">· {{ worldshardStockUi.rate }}</span>
            </p>
            <p
              class="play-cloud-header__stat"
              :class="`play-cloud-header__stat--${woodStockUi.level}`"
              :title="`Bois ${formatStock(woodStockUi.amount)}/${formatStock(woodStockUi.cap)}`"
            >
              <UIcon name="i-lucide-tree-pine" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Bois</span>
              <span class="play-cloud-header__stock">
                {{ formatStock(woodStockUi.amount) }}<span class="play-cloud-header__cap">/{{ formatStock(woodStockUi.cap) }}</span>
              </span>
              <span class="play-cloud-header__rate">· {{ woodStockUi.rate }}</span>
            </p>
            <p
              class="play-cloud-header__stat"
              :class="`play-cloud-header__stat--${foodStockUi.level}`"
              :title="`Nourriture ${formatStock(foodStockUi.amount)}/${formatStock(foodStockUi.cap)}`"
            >
              <UIcon name="i-lucide-beef" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Food</span>
              <span class="play-cloud-header__stock">
                {{ formatStock(foodStockUi.amount) }}<span class="play-cloud-header__cap">/{{ formatStock(foodStockUi.cap) }}</span>
              </span>
              <span class="play-cloud-header__rate">· {{ foodStockUi.rate }}</span>
            </p>
            <p
              class="play-cloud-header__stat"
              :class="`play-cloud-header__stat--${wheatStockUi.level}`"
              :title="`Blé ${formatStock(wheatStockUi.amount)}/${formatStock(wheatStockUi.cap)}`"
            >
              <UIcon name="i-lucide-wheat" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Blé</span>
              <span class="play-cloud-header__stock">
                {{ formatStock(wheatStockUi.amount) }}<span class="play-cloud-header__cap">/{{ formatStock(wheatStockUi.cap) }}</span>
              </span>
              <span class="play-cloud-header__rate">· {{ wheatStockUi.rate }}</span>
            </p>
            <p
              class="play-cloud-header__stat"
              :class="`play-cloud-header__stat--${stoneStockUi.level}`"
              :title="`Pierre ${formatStock(stoneStockUi.amount)}/${formatStock(stoneStockUi.cap)}`"
            >
              <UIcon name="i-lucide-stone" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Pierre</span>
              <span class="play-cloud-header__stock">
                {{ formatStock(stoneStockUi.amount) }}<span class="play-cloud-header__cap">/{{ formatStock(stoneStockUi.cap) }}</span>
              </span>
              <span class="play-cloud-header__rate">· {{ stoneStockUi.rate }}</span>
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="stockSinkHint && !expandError"
        class="pointer-events-none absolute inset-x-0 top-full z-10 flex justify-center px-3"
      >
        <span class="mt-1 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-[#6b5a2e] shadow-md ring-1 ring-[#c4a35a]/35 backdrop-blur-sm">
          {{ stockSinkHint }}
        </span>
      </p>

      <p
        v-if="expandError"
        class="pointer-events-none absolute inset-x-0 top-full z-10 flex justify-center px-3"
      >
        <span class="mt-1 rounded-full bg-white/80 px-3 py-1 text-xs text-[#9b4a4a] shadow-md ring-1 ring-[#9b4a4a]/20 backdrop-blur-sm">
          {{ expandError }}
        </span>
      </p>
    </header>

    <div
      v-if="expanding || building || settingBiome || destroying"
      class="pointer-events-none absolute inset-x-0 top-24 z-40 flex justify-center"
    >
      <p class="rounded-full border border-[#1c2b28]/10 bg-white/80 px-3 py-1.5 text-xs text-[#3d524c] shadow-[0_8px_24px_rgb(28_43_40_/_0.08)] backdrop-blur-md">
        {{
          destroying
            ? "Destruction…"
            : settingBiome
              ? "Changement de biome…"
              : building
                ? "Construction…"
                : "Extension du monde…"
        }}
      </p>
    </div>

    <button
      v-if="world && isDevClient && !debugChromeVisible"
      type="button"
      class="play-dev-chrome play-dev-chrome--toggle pointer-events-auto absolute left-3 z-30 flex size-11 items-center justify-center rounded-full border border-[#1c2b28]/12 bg-white/80 text-[#2d5248] shadow-[0_8px_24px_rgb(28_43_40_/_0.1)] backdrop-blur-md transition hover:border-[#4a7c6f]/45 hover:text-[#1c2b28] active:scale-95"
      title="Afficher l’interface debug"
      aria-label="Afficher l’interface debug"
      @click="toggleDebugChrome"
    >
      <UIcon name="i-lucide-bug" class="size-5" />
    </button>

    <div
      v-if="world && isDevClient && debugChromeVisible"
      class="play-dev-chrome play-dev-chrome--panel pointer-events-auto absolute left-3 z-30 flex max-w-[calc(100%-5.5rem)] flex-wrap items-center gap-2"
    >
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#1c2b28]/12 bg-white/75 px-3 text-xs font-semibold tracking-wide text-[#3d524c] shadow-[0_8px_24px_rgb(28_43_40_/_0.08)] backdrop-blur-md transition hover:border-[#4a7c6f]/45 hover:text-[#1c2b28] active:scale-95"
        title="Masquer l’interface debug"
        aria-label="Masquer l’interface debug"
        @click="toggleDebugChrome"
      >
        <UIcon name="i-lucide-eye-off" class="size-4" />
      </button>
      <button
        type="button"
        class="flex h-11 items-center gap-1.5 rounded-full border border-[#1c2b28]/12 bg-white/75 px-3 text-xs font-semibold tracking-wide text-[#3d524c] shadow-[0_8px_24px_rgb(28_43_40_/_0.08)] backdrop-blur-md transition hover:border-[#4a7c6f]/45 hover:text-[#1c2b28] active:scale-95 disabled:opacity-50"
        :disabled="resetting || granting || expanding || building || settingBiome"
        @click="onResetWorld"
      >
        <UIcon name="i-lucide-rotate-ccw" class="size-4" />
        {{ resetting ? "Reset…" : "Reset monde" }}
      </button>
      <button
        type="button"
        class="flex h-11 items-center gap-1.5 rounded-full border border-[#1c2b28]/12 bg-white/75 px-3 text-xs font-semibold tracking-wide text-[#3d524c] shadow-[0_8px_24px_rgb(28_43_40_/_0.08)] backdrop-blur-md transition hover:border-[#4a7c6f]/45 hover:text-[#1c2b28] active:scale-95"
        title="Relancer le tutoriel FTUE"
        @click="resetTutorial"
      >
        <UIcon name="i-lucide-graduation-cap" class="size-4" />
        Reset tuto
      </button>
      <button
        type="button"
        class="flex h-11 items-center gap-1.5 rounded-full border border-[#4a7c6f]/35 bg-[#2d5248] px-3 text-xs font-semibold tracking-wide text-[#f2f7f4] shadow-[0_8px_24px_rgb(45_82_72_/_0.18)] backdrop-blur-md transition hover:bg-[#243f38] active:scale-95 disabled:opacity-50"
        :disabled="resetting || granting || expanding || building || settingBiome"
        title="+ressources (+ éclats)"
        @click="onGrantResources"
      >
        <UIcon name="i-lucide-package-plus" class="size-4" />
        {{ granting ? "…" : "+ Ressources" }}
      </button>
      <div
        class="flex h-11 items-center gap-1 rounded-full border border-[#1c2b28]/12 bg-white/75 px-2 text-[11px] font-semibold tracking-wide text-[#3d524c] shadow-[0_8px_24px_rgb(28_43_40_/_0.08)] backdrop-blur-md"
        title="Ads simulation (dev)"
      >
        <span class="px-1 opacity-60">Ads</span>
        <button
          type="button"
          class="rounded-full px-2.5 py-1 transition"
          :class="
            !hasNoAds
              ? 'bg-[#2d5248] text-[#f2f7f4]'
              : 'text-[#3d524c] hover:bg-[#1c2b28]/06'
          "
          @click="setDevNoAds(false)"
        >
          Free
        </button>
        <button
          type="button"
          class="rounded-full px-2.5 py-1 transition"
          :class="
            hasNoAds
              ? 'bg-[#2d5248] text-[#f2f7f4]'
              : 'text-[#3d524c] hover:bg-[#1c2b28]/06'
          "
          @click="setDevNoAds(true)"
        >
          No Ads
        </button>
      </div>
    </div>

    <div v-if="world" class="play-right-chrome">
      <div class="play-right-chrome__stack">
        <ScienceDock
          :active="techTimelineOpen"
          :research="projectedResearch"
          @click="techTimelineOpen = !techTimelineOpen"
        />
        <button
          v-if="!constructionMenuOpen"
          type="button"
          class="play-construction-fab pointer-events-auto"
          data-tutorial="build-menu-toggle"
          aria-label="Afficher le menu construction"
          :aria-expanded="false"
          @click="toggleConstructionMenu"
        >
          <UIcon name="i-lucide-hammer" class="size-5" />
        </button>
      </div>
    </div>

    <Transition name="biome-wheel">
      <div
        v-if="showBiomeWheel"
        class="pointer-events-none absolute inset-0 z-40"
      >
        <div
          ref="wheelRoot"
          class="biome-wheel__ring absolute"
          :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="wheelStyle"
        >
          <p
            v-if="regionExpansionCost"
            class="absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm"
            :class="
              canAffordRegion
                ? 'border-[#1c2b28]/12 bg-white/85 text-[#2d5248]'
                : 'border-[#9b4a4a]/30 bg-white/85 text-[#9b4a4a]'
            "
            :style="regionCostStyle"
          >
            {{ regionCostLabel }}
          </p>
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-[#1c2b28]/12 bg-white/85 text-[#3d524c] shadow-md backdrop-blur-sm"
            :style="cancelButtonStyle"
            aria-label="Annuler"
            @click="clearSelection"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
          <button
            v-for="slot in wheelSlots"
            :key="slot.biome.id"
            type="button"
            :data-tutorial="slot.biome.id === 'plains' ? 'biome-plains' : undefined"
            class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a7c6f]"
            :class="
              canAffordRegion
                ? 'border-white/80 hover:scale-110'
                : 'border-white/40 opacity-45'
            "
            :style="[slot.style, { backgroundColor: biomeSwatch[slot.biome.id] }]"
            :title="
              canAffordRegion
                ? `${slot.biome.label} · ${regionCostLabel}`
                : `${slot.biome.label} · pas assez d’éclats`
            "
            :aria-label="slot.biome.label"
            :disabled="!canAffordRegion"
            @click="generate(slot.biome.id)"
          >
            <UIcon
              :name="biomeIcon[slot.biome.id]"
              class="size-5"
              :class="slot.biome.id === 'mountain' ? 'text-stone-700' : 'text-white'"
            />
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="building-sheet">
      <aside
        v-if="world && constructionMenuOpen"
        ref="constructionBar"
        class="building-sheet construction-sheet pointer-events-none absolute inset-x-0 z-40"
        :class="{ 'construction-sheet--raised': constructionSheetRaised }"
      >
        <div class="building-sheet__sky" aria-hidden="true">
          <svg
            class="building-sheet__svg"
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="play-cloud-construction-fill" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97" />
                <stop offset="55%" stop-color="#f4f8f5" stop-opacity="0.94" />
                <stop offset="100%" stop-color="#e4eee8" stop-opacity="0.78" />
              </linearGradient>
              <filter id="play-cloud-construction-soft" x="-4%" y="-35%" width="108%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
              </filter>
            </defs>
            <path
              fill="url(#play-cloud-construction-fill)"
              filter="url(#play-cloud-construction-soft)"
              d="M0 180H1200V48
                C1080 48 1000 28 880 34
                C740 42 660 22 520 30
                C380 38 300 20 180 32
                C90 40 40 44 0 48
                Z"
            />
          </svg>
          <div class="building-sheet__puff building-sheet__puff--1" />
          <div class="building-sheet__puff building-sheet__puff--2" />
          <div class="building-sheet__puff building-sheet__puff--3" />
          <div class="building-sheet__puff building-sheet__puff--4" />
        </div>

        <div class="building-sheet__content pointer-events-auto">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="building-sheet__title">Construire</p>
              <p v-if="constructionMode" class="building-sheet__hint">
                Vert = possible · Rouge = impossible — clique une case verte
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="constructionMode"
                type="button"
                class="construction-sheet__cancel"
                aria-label="Annuler le mode construction"
                @click="cancelConstructionMode"
              >
                Annuler
              </button>
              <button
                type="button"
                class="building-sheet__close"
                aria-label="Fermer le menu construction"
                @click="closeConstructionMenu"
              >
                <UIcon name="i-lucide-x" class="size-4" />
              </button>
            </div>
          </div>

          <div class="construction-sheet__scroll">
            <button
              v-for="entry in constructionCatalog"
              :key="entry.id"
              type="button"
              :data-tutorial="entry.id === 'lumber_camp' ? 'build-lumber_camp' : undefined"
              class="construction-sheet__item"
              :class="{
                'construction-sheet__item--active': entry.active,
                'construction-sheet__item--disabled': !entry.canAfford && !entry.active,
                'construction-sheet__item--locked': !entry.isUnlocked
              }"
              :title="
                !entry.isUnlocked
                  ? `${entry.label} · tech ${entry.requiredTechLabel ?? 'requise'}`
                  : !entry.canAfford
                    ? !entry.canAffordWood && !entry.hasIdlePop
                      ? `${entry.label} · pas assez de bois ni de pop libre`
                      : !entry.canAffordWood
                        ? `${entry.label} · pas assez de bois`
                        : `${entry.label} · pas assez de pop libre`
                    : `${entry.label} · ${entry.woodCost} bois · ${BUILD_IDLE_POP_REQUIREMENT} pop`
              "
              :aria-label="entry.label"
              :aria-pressed="entry.active"
              @click="selectConstruction(entry.id)"
            >
              <UIcon :name="entry.icon" class="construction-sheet__item-icon" />
              <span class="construction-sheet__item-name">{{ entry.short }}</span>
              <span
                v-if="!entry.isUnlocked"
                class="construction-sheet__item-lock"
              >
                <UIcon name="i-lucide-lock" class="size-3" aria-hidden="true" />
                {{ entry.requiredTechLabel }}
              </span>
              <span
                v-else
                class="construction-sheet__item-cost"
                :class="{ 'construction-sheet__item-cost--warn': !entry.canAffordWood }"
              >
                {{ entry.woodCost }} bois
              </span>
            </button>
          </div>
        </div>
      </aside>
    </Transition>

    <TechTimelinePanel
      v-model:open="techTimelineOpen"
      :research="projectedResearch"
      :selecting="selectingResearch"
      :unlock-notice="researchUnlockNotice"
      @select-tech="onSelectResearchTarget"
    />

    <Transition name="biome-wheel">
      <div
        v-if="showDebugHub"
        class="pointer-events-none absolute inset-0 z-40"
      >
        <div
          ref="wheelRoot"
          class="biome-wheel__ring absolute"
          :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="wheelStyle"
        >
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-[#1c2b28]/12 bg-white/85 text-[#3d524c] shadow-md backdrop-blur-sm"
            :style="cancelButtonStyle"
            aria-label="Annuler"
            @click="clearSelection"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
          <button
            type="button"
            class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 border-[#9b4a4a]/40 bg-[#fff5f3] text-[#9b4a4a] shadow-md transition hover:scale-110"
            :style="debugBugButtonStyle"
            title="Debug biome"
            aria-label="Debug biome"
            @click="openDebugBiomeWheel"
          >
            <UIcon name="i-lucide-bug" class="size-5" />
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="biome-wheel">
      <div
        v-if="showDebugBiomeWheel"
        class="pointer-events-none absolute inset-0 z-40"
      >
        <div
          ref="wheelRoot"
          class="biome-wheel__ring absolute"
          :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="wheelStyle"
        >
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-[#1c2b28]/12 bg-white/85 text-[#3d524c] shadow-md backdrop-blur-sm"
            :style="cancelButtonStyle"
            aria-label="Retour"
            :disabled="settingBiome"
            @click="closeDebugBiomeWheel"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-[#9b4a4a]/35 bg-[#fff5f3] text-[#9b4a4a] shadow-md backdrop-blur-sm transition hover:scale-110"
            :style="debugBugOnBiomeStyle"
            title="Fermer debug biome"
            aria-label="Fermer debug biome"
            :disabled="settingBiome"
            @click="closeDebugBiomeWheel"
          >
            <UIcon name="i-lucide-bug" class="size-3.5" />
          </button>
          <button
            v-for="slot in debugBiomeWheelSlots"
            :key="slot.biome.id"
            type="button"
            class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a7c6f] hover:scale-110 disabled:opacity-50"
            :class="
              slot.active
                ? 'border-[#2d5248] ring-2 ring-[#4a7c6f]/50'
                : 'border-white/80'
            "
            :style="[slot.style, { backgroundColor: biomeSwatch[slot.biome.id] }]"
            :title="slot.biome.label"
            :aria-label="slot.biome.label"
            :disabled="settingBiome"
            @click="applyDebugBiome(slot.biome.id)"
          >
            <UIcon
              :name="biomeIcon[slot.biome.id]"
              class="size-5"
              :class="
                slot.biome.id === 'mountain' || slot.biome.id === 'plains_mountain'
                  ? 'text-stone-700'
                  : 'text-white'
              "
            />
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="building-sheet">
      <aside
        v-if="showBuildingSheet && selected"
        ref="buildingSheet"
        class="building-sheet pointer-events-none absolute inset-x-0 bottom-0 z-50"
      >
        <div class="building-sheet__sky" aria-hidden="true">
          <svg
            class="building-sheet__svg"
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="play-cloud-sheet-fill" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97" />
                <stop offset="55%" stop-color="#f4f8f5" stop-opacity="0.94" />
                <stop offset="100%" stop-color="#e4eee8" stop-opacity="0.78" />
              </linearGradient>
              <filter id="play-cloud-sheet-soft" x="-4%" y="-35%" width="108%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
              </filter>
            </defs>
            <path
              fill="url(#play-cloud-sheet-fill)"
              filter="url(#play-cloud-sheet-soft)"
              d="M0 180H1200V48
                C1080 48 1000 28 880 34
                C740 42 660 22 520 30
                C380 38 300 20 180 32
                C90 40 40 44 0 48
                Z"
            />
          </svg>
          <div class="building-sheet__puff building-sheet__puff--1" />
          <div class="building-sheet__puff building-sheet__puff--2" />
          <div class="building-sheet__puff building-sheet__puff--3" />
          <div class="building-sheet__puff building-sheet__puff--4" />
        </div>

        <div class="building-sheet__content pointer-events-auto">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="building-sheet__title truncate">
                {{ selectedBuildingTitle }}
              </p>
              <template v-if="showTileInfoSheet">
                <p class="building-sheet__hint">
                  {{ selectedTileBiomeInfo?.description }}
                </p>
              </template>
              <template v-else>
                <p v-if="selectedConstruction && !destroyConfirm" class="building-sheet__hint">
                  En construction · {{ selectedConstruction.label }} · 1 habitant réservé
                </p>
                <p v-else-if="selectedWorkerPanel && !destroyConfirm" class="building-sheet__hint">
                  {{ selectedWorkerPanel.hint }}
                </p>
                <p v-else-if="selected.hasVillage" class="building-sheet__hint">
                  Cœur de ton territoire.
                </p>
                <p v-else-if="destroyConfirm" class="building-sheet__hint">
                  Confirmation requise
                </p>
              </template>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="canDestroySelectedBuilding && !destroyConfirm"
                type="button"
                class="building-sheet__close"
                title="Détruire le bâtiment"
                aria-label="Détruire le bâtiment"
                :disabled="destroying"
                @click="askDestroyBuilding"
              >
                <UIcon name="i-lucide-trash-2" class="size-4 text-[#9b4a4a]" />
              </button>
              <button
                v-if="showDebugBugOnSheet"
                type="button"
                class="building-sheet__close"
                title="Debug biome"
                aria-label="Debug biome"
                @click="openDebugBiomeWheel"
              >
                <UIcon name="i-lucide-bug" class="size-4 text-[#9b4a4a]" />
              </button>
              <button
                type="button"
                class="building-sheet__close"
                aria-label="Fermer"
                @click="clearSelection"
              >
                <UIcon name="i-lucide-x" class="size-4" />
              </button>
            </div>
          </div>

          <div
            v-if="showTileInfoSheet && selectedTilePoiInfo"
            class="mt-3 rounded-2xl border border-[#1c2b28]/10 bg-white/70 px-3 py-2.5"
          >
            <p class="text-sm font-semibold text-[#1c2b28]">
              {{ selectedTilePoiInfo.label }}
            </p>
            <p class="mt-0.5 text-xs leading-relaxed text-[#3d524c]/90">
              {{ selectedTilePoiInfo.description }}
            </p>
          </div>

          <div
            v-if="destroyConfirm"
            class="mt-3 rounded-2xl border border-[#9b4a4a]/25 bg-[#fff5f3]/90 px-3 py-3"
          >
            <p class="text-sm font-medium text-[#7a3535]">
              Détruire {{ selectedBuildingTitle }} ?
            </p>
            <p class="mt-1 text-xs text-[#9b4a4a]/90">
              <template v-if="destroyRefundPreview.wood > 0 || destroyRefundPreview.workers > 0">
                Récupère
                <template v-if="destroyRefundPreview.wood > 0">
                  {{ destroyRefundPreview.wood }} bois
                </template>
                <template v-if="destroyRefundPreview.wood > 0 && destroyRefundPreview.workers > 0">
                  ·
                </template>
                <template v-if="destroyRefundPreview.workers > 0">
                  {{ destroyRefundPreview.workers }} habitant{{ destroyRefundPreview.workers > 1 ? "s" : "" }} libre{{ destroyRefundPreview.workers > 1 ? "s" : "" }}
                </template>
              </template>
              <template v-else>
                Les habitants redeviennent libres.
              </template>
            </p>
            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                class="flex h-9 flex-1 items-center justify-center rounded-full border border-[#1c2b28]/12 bg-white/80 text-xs font-semibold text-[#3d524c] transition hover:bg-white disabled:opacity-50"
                :disabled="destroying"
                @click="cancelDestroyBuilding"
              >
                Annuler
              </button>
              <button
                type="button"
                class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#9b4a4a] text-xs font-semibold text-white transition hover:bg-[#823c3c] disabled:opacity-50"
                :disabled="destroying"
                @click="confirmDestroyBuilding"
              >
                <UIcon name="i-lucide-trash-2" class="size-3.5" />
                {{ destroying ? "…" : "Détruire" }}
              </button>
            </div>
          </div>

          <div
            v-if="selectedConstruction && !destroyConfirm"
            class="mt-3"
          >
            <div class="h-1.5 overflow-hidden rounded-full bg-[#1c2b28]/10">
              <div
                class="h-full rounded-full bg-[#4a7c6f] transition-[width] duration-1000 linear"
                :style="{ width: `${Math.round(selectedConstruction.progress * 100)}%` }"
              />
            </div>
          </div>

          <div
            v-if="selectedWorkerPanel && !destroyConfirm"
            class="mt-3 flex items-center justify-between gap-3"
          >
            <div>
              <p class="building-sheet__metric">
                {{ selectedWorkerPanel.title }}
                <span class="font-mono">
                  {{ selectedWorkerPanel.count }}/{{ selectedWorkerPanel.max }}
                </span>
              </p>
              <p class="building-sheet__hint mt-0.5">
                {{ selectedWorkerPanel.rateLabel }} · {{ idlePop }} libre{{ idlePop === 1 ? "" : "s" }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="building-sheet__stepper"
                :disabled="!selectedWorkerPanel.canRemove"
                :aria-label="`Retirer un ${selectedWorkerPanel.title.toLowerCase()}`"
                @click="setWorkers(selectedWorkerPanel.count - 1)"
              >
                −
              </button>
              <button
                type="button"
                class="building-sheet__stepper"
                :disabled="!selectedWorkerPanel.canAdd"
                :aria-label="`Ajouter un ${selectedWorkerPanel.title.toLowerCase()}`"
                @click="setWorkers(selectedWorkerPanel.count + 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </aside>
    </Transition>

    <PlayTutorialCoach
      v-if="tutorialActive && tutorialStep && world"
      :step="tutorialStep"
      :step-index="tutorialStepIndex"
      :step-count="PLAY_TUTORIAL_STEPS.length"
      :hole="tutorialHole"
      :lock-map="tutorialLockMap"
      :stage-width="tutorialStageSize.width"
      :stage-height="tutorialStageSize.height"
      @next="nextTutorialStep"
      @skip="skipTutorial"
      @finish="completeTutorial"
    />

    <LinkAccountDialog
      v-model:open="linkAccountOpen"
      @dismiss="dismissLinkAccount"
    />

    <SupportReportDialog
      v-model:open="supportOpen"
      :world-id="world?.id ?? null"
    />

    <NotificationSettingsPanel v-model:open="notificationSettingsOpen" />

    <Teleport to="body">
      <Transition name="play-disconnect-sheet">
        <div
          v-if="disconnectConfirmOpen && isGuest"
          class="play-disconnect-sheet"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="disconnect-warn-title"
          aria-describedby="disconnect-warn-desc"
        >
          <button
            type="button"
            class="play-disconnect-sheet__backdrop"
            aria-label="Fermer"
            :disabled="disconnecting"
            @click="cancelDisconnect"
          />
          <div class="play-disconnect-sheet__panel">
            <div class="play-disconnect-sheet__handle" aria-hidden="true" />
            <div class="play-disconnect-sheet__icon" aria-hidden="true">
              <UIcon name="i-lucide-triangle-alert" class="size-7" />
            </div>
            <h2 id="disconnect-warn-title" class="play-disconnect-sheet__title">
              Quitter en invité&nbsp;?
            </h2>
            <p id="disconnect-warn-desc" class="play-disconnect-sheet__body">
              Tu n’as pas de compte lié. Toute ta progression (monde, bâtiments, ressources) sera perdue.
            </p>
            <div class="play-disconnect-sheet__actions">
              <button
                type="button"
                class="play-disconnect-sheet__btn play-disconnect-sheet__btn--primary"
                :disabled="disconnecting"
                @click="cancelDisconnect"
              >
                Rester
              </button>
              <button
                type="button"
                class="play-disconnect-sheet__btn play-disconnect-sheet__btn--primary"
                :disabled="disconnecting"
                @click="openLinkAccountFromDisconnect"
              >
                Lier mon compte
              </button>
              <button
                type="button"
                class="play-disconnect-sheet__btn play-disconnect-sheet__btn--danger"
                :disabled="disconnecting"
                @click="disconnect"
              >
                {{ disconnecting ? "…" : "Quitter quand même" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
