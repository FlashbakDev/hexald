import type {
  AssignWorkersRequest,
  BuildRequest,
  BuildResult,
  ExpandRegionRequest,
  ExpandRegionResult,
  ExtractorJob,
  HexCoord,
  PrimaryBiomeId,
  WorldSnapshot,
  WorldSummary
} from "@hexald/shared";

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

  async function expandRegion(
    id: string,
    center: HexCoord,
    biome: PrimaryBiomeId
  ): Promise<ExpandRegionResult | null> {
    error.value = null;
    try {
      const body: ExpandRegionRequest = { center, biome };
      const result = await $fetch<ExpandRegionResult>(`/v1/worlds/${id}/regions`, {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        body
      });
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "expand_failed";
      return null;
    }
  }

  async function assignWorkers(
    id: string,
    job: ExtractorJob,
    count: number
  ): Promise<WorldSnapshot | null> {
    error.value = null;
    try {
      const body: AssignWorkersRequest = { job, count };
      const snapshot = await $fetch<WorldSnapshot>(`/v1/worlds/${id}/workers`, {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        body
      });
      world.value = snapshot;
      return snapshot;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "assign_failed";
      return null;
    }
  }

  async function buildBuilding(
    id: string,
    buildingId: BuildRequest["buildingId"],
    origin: HexCoord
  ): Promise<BuildResult | null> {
    error.value = null;
    try {
      const body: BuildRequest = { buildingId, origin };
      const result = await $fetch<BuildResult>(`/v1/worlds/${id}/buildings`, {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        body
      });
      world.value = result.world;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "build_failed";
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
    expandRegion,
    assignWorkers,
    buildBuilding
  };
}
