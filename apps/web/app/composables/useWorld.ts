import type {
  ApplyActionOutcome,
  BiomeId,
  BuildRequest,
  BuildResult,
  DestroyBuildingRequest,
  DestroyBuildingResult,
  ExpandRegionResult,
  GameAction,
  HexCoord,
  PrimaryBiomeId,
  TechId,
  WorldSnapshot,
  WorldSummary
} from "@hexald/shared";

function fetchErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("data" in err)) return undefined;
  return (err as { data?: { error?: string } }).data?.error;
}

function expandErrorMessage(err: unknown): string {
  const code = fetchErrorCode(err);
  if (code === "insufficient_resources") {
    return "Pas assez d’éclats de monde pour étendre.";
  }
  if (code === "cannot_place_region") {
    return "Impossible de placer cette région.";
  }
  return err instanceof Error ? err.message : "expand_failed";
}

function buildErrorMessage(err: unknown): string {
  const code = fetchErrorCode(err);
  if (code === "insufficient_resources") {
    return "Pas assez de bois pour construire.";
  }
  if (code === "insufficient_population") {
    return "Pas assez de pop libre pour construire (1 requis).";
  }
  if (code === "tech_not_unlocked") {
    return "Tech requise non débloquée — ouvre l’arbre technologique.";
  }
  return err instanceof Error ? err.message : "build_failed";
}

function actionErrorMessage(action: GameAction, err: unknown): string {
  const code = fetchErrorCode(err);
  if (code === "world_busy") {
    return "Monde occupé — réessaie dans un instant.";
  }
  if (action.type === "generate_region") return expandErrorMessage(err);
  if (action.type === "build") return buildErrorMessage(err);
  return err instanceof Error ? err.message : "action_failed";
}

export function useWorld() {
  const config = useRuntimeConfig();
  const worldId = useState<string | null>("world-id", () => null);
  const world = useState<WorldSnapshot | null>("world-snapshot", () => null);
  const error = useState<string | null>("world-error", () => null);

  async function listWorlds(): Promise<WorldSummary[]> {
    return $fetch<WorldSummary[]>("/v1/worlds", {
      baseURL: config.public.apiBase,
      credentials: "include"
    });
  }

  async function createWorld(): Promise<WorldSnapshot> {
    return $fetch<WorldSnapshot>("/v1/worlds", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include"
    });
  }

  async function getWorld(id: string): Promise<WorldSnapshot> {
    return $fetch<WorldSnapshot>(`/v1/worlds/${id}`, {
      baseURL: config.public.apiBase,
      credentials: "include"
    });
  }

  async function ensureWorld(): Promise<WorldSnapshot | null> {
    error.value = null;
    try {
      const summaries = await listWorlds();
      const latest = summaries[0];
      const snapshot = latest ? await getWorld(latest.id) : await createWorld();
      worldId.value = snapshot.id;
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      worldId.value = null;
      world.value = null;
      error.value = err instanceof Error ? err.message : "world_failed";
      return null;
    }
  }

  async function refreshWorld(): Promise<WorldSnapshot | null> {
    const id = worldId.value;
    if (!id) return null;
    error.value = null;
    try {
      const snapshot = await getWorld(id);
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "world_failed";
      return null;
    }
  }

  async function applyAction(
    id: string,
    action: GameAction
  ): Promise<ApplyActionOutcome | null> {
    error.value = null;
    try {
      const outcome = await $fetch<ApplyActionOutcome>(
        `/v1/worlds/${id}/actions`,
        {
          baseURL: config.public.apiBase,
          method: "POST",
          credentials: "include",
          body: action
        }
      );
      if (outcome.ok) {
        if (outcome.type === "assign_workers" || outcome.type === "set_research_target") {
          world.value = outcome.world;
        } else {
          world.value = outcome.result.world;
        }
      }
      return outcome;
    } catch (err) {
      error.value = actionErrorMessage(action, err);
      return null;
    }
  }

  async function expandRegion(
    id: string,
    center: HexCoord,
    biome: PrimaryBiomeId
  ): Promise<ExpandRegionResult | null> {
    const outcome = await applyAction(id, {
      type: "generate_region",
      center,
      biome
    });
    if (!outcome?.ok || outcome.type !== "generate_region") return null;
    return outcome.result;
  }

  async function assignWorkers(
    id: string,
    origin: HexCoord,
    count: number
  ): Promise<WorldSnapshot | null> {
    const outcome = await applyAction(id, {
      type: "assign_workers",
      origin,
      count
    });
    if (!outcome?.ok || outcome.type !== "assign_workers") return null;
    return outcome.world;
  }

  async function buildBuilding(
    id: string,
    buildingId: BuildRequest["buildingId"],
    origin: HexCoord
  ): Promise<BuildResult | null> {
    const outcome = await applyAction(id, {
      type: "build",
      buildingId,
      origin
    });
    if (!outcome?.ok || outcome.type !== "build") return null;
    return outcome.result;
  }

  async function setResearchTarget(
    id: string,
    techId: TechId
  ): Promise<WorldSnapshot | null> {
    const outcome = await applyAction(id, {
      type: "set_research_target",
      techId
    });
    if (!outcome?.ok || outcome.type !== "set_research_target") return null;
    return outcome.world;
  }

  async function destroyBuilding(
    id: string,
    origin: HexCoord
  ): Promise<DestroyBuildingResult | null> {
    error.value = null;
    try {
      const body: DestroyBuildingRequest = { origin };
      const result = await $fetch<DestroyBuildingResult>(
        `/v1/worlds/${id}/buildings/destroy`,
        {
          baseURL: config.public.apiBase,
          method: "POST",
          credentials: "include",
          body
        }
      );
      world.value = result.world;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "destroy_failed";
      return null;
    }
  }

  async function resetWorld(id: string): Promise<WorldSnapshot | null> {
    error.value = null;
    try {
      const snapshot = await $fetch<WorldSnapshot>(`/v1/worlds/${id}/reset`, {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include"
      });
      worldId.value = snapshot.id;
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "reset_failed";
      return null;
    }
  }

  async function grantDevResources(id: string): Promise<WorldSnapshot | null> {
    error.value = null;
    try {
      const snapshot = await $fetch<WorldSnapshot>(
        `/v1/worlds/${id}/dev/grant-resources`,
        {
          baseURL: config.public.apiBase,
          method: "POST",
          credentials: "include"
        }
      );
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "grant_failed";
      return null;
    }
  }

  async function setTileBiomeDev(
    id: string,
    origin: HexCoord,
    biome: BiomeId
  ): Promise<WorldSnapshot | null> {
    error.value = null;
    try {
      const snapshot = await $fetch<WorldSnapshot>(
        `/v1/worlds/${id}/dev/set-tile-biome`,
        {
          baseURL: config.public.apiBase,
          method: "POST",
          credentials: "include",
          body: { q: origin.q, r: origin.r, biome }
        }
      );
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "set_biome_failed";
      return null;
    }
  }

  return {
    worldId,
    world,
    error,
    listWorlds,
    createWorld,
    getWorld,
    ensureWorld,
    refreshWorld,
    applyAction,
    setResearchTarget,
    expandRegion,
    assignWorkers,
    buildBuilding,
    destroyBuilding,
    resetWorld,
    grantDevResources,
    setTileBiomeDev
  };
}
