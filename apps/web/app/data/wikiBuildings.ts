import {
  buildings,
  getBiomeDefinition,
  getBuildingDefinition,
  getPoiDefinition,
  getRecipeStepForBuilding,
  getTechNode,
  resources,
  type BuildingDefinition,
  type BuildingRole,
  type BuildingStatus
} from "@hexald/content";
import type { BuildingId, ResourceId, TechId } from "@hexald/shared";

export type WikiInfoboxRow = {
  label: string;
  value: string;
  href?: string;
};

export type WikiIndexItem = {
  id: BuildingId;
  definition: BuildingDefinition;
  summary: string;
  path: string;
};

const ROLE_LABELS: Record<BuildingRole, string> = {
  extractor: "Extracteur",
  processor: "Transformateur",
  settlement: "Habitat",
  special: "Spécial"
};

const STATUS_LABELS: Record<BuildingStatus, string> = {
  mvp: "Disponible",
  planned: "Prévu",
  later: "Plus tard"
};

const ROLE_ORDER: BuildingRole[] = [
  "extractor",
  "processor",
  "settlement",
  "special"
];

export function buildingRoleLabel(role: BuildingRole) {
  return ROLE_LABELS[role];
}

export function buildingStatusLabel(status: BuildingStatus) {
  return STATUS_LABELS[status];
}

export function resourceLabel(id: string | null | undefined) {
  if (!id) return "—";
  if (id === "workers") return "Ouvriers";
  if (id === "population") return "Population";
  if (id === "prestige") return "Prestige";
  const found = resources.find((r) => r.id === id);
  return found?.label ?? id;
}

export function terrainLabel(terrain: BuildingDefinition["terrain"]) {
  if (terrain === "any") return "Tout terrain constructible";
  return getBiomeDefinition(terrain)?.label ?? terrain;
}

export function techLabel(techId: string | null | undefined) {
  if (!techId) return "Aucune";
  try {
    return getTechNode(techId as TechId).label;
  } catch {
    return techId;
  }
}

export function poiLabel(poiId: string | null | undefined) {
  if (!poiId) return "—";
  return getPoiDefinition(poiId)?.label ?? poiId;
}

export function formatBuildDuration(ms: number | undefined) {
  if (ms == null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

export function formatProductionRate(
  building: BuildingDefinition
): string | null {
  if (building.ratePerWorkerPerMinute == null) return null;
  const rate = building.ratePerWorkerPerMinute;
  if (building.id === "market" || (rate > 0 && rate < 1)) {
    const minutes = Math.round(1 / rate);
    return `1 / ${minutes} min`;
  }
  return `${rate} / min / ouvrier`;
}

export function wikiBuildingPath(id: BuildingId) {
  return `/wiki/buildings/${id}`;
}

export function buildingIdFromWikiPath(path: string): BuildingId | null {
  const match = /^\/wiki\/buildings\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  const id = match[1] as BuildingId;
  return getBuildingDefinition(id) ? id : null;
}

export function listCatalogBuildingsByRole() {
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    items: buildings.filter((b) => b.role === role)
  })).filter((group) => group.items.length > 0);
}

/** Joint catalogue + entrées Content (path + summary). */
export function mergeWikiBuildingIndex(
  pages: readonly { path?: string; summary?: string }[]
): {
  role: BuildingRole;
  label: string;
  items: WikiIndexItem[];
}[] {
  const byId = new Map<string, { path: string; summary: string }>();
  for (const page of pages) {
    if (!page.path) continue;
    const id = buildingIdFromWikiPath(page.path);
    if (!id) continue;
    byId.set(id, {
      path: page.path,
      summary: page.summary?.trim() || ""
    });
  }

  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    items: buildings
      .filter((definition) => definition.role === role)
      .map((definition) => {
        const page = byId.get(definition.id);
        return {
          id: definition.id,
          definition,
          summary: page?.summary || definition.label,
          path: page?.path || wikiBuildingPath(definition.id)
        };
      })
  })).filter((group) => group.items.length > 0);
}

export function wikiBuildingInfoboxRows(
  building: BuildingDefinition
): WikiInfoboxRow[] {
  const rows: WikiInfoboxRow[] = [
    { label: "Rôle", value: ROLE_LABELS[building.role] },
    { label: "Statut", value: STATUS_LABELS[building.status] },
    { label: "Terrain", value: terrainLabel(building.terrain) }
  ];

  if (building.woodCost != null) {
    rows.push({ label: "Coût", value: `${building.woodCost} bois` });
  }
  if (building.buildDurationMs != null) {
    rows.push({
      label: "Construction",
      value: formatBuildDuration(building.buildDurationMs)
    });
  }
  if (building.requiredTechId) {
    rows.push({
      label: "Tech requise",
      value: techLabel(building.requiredTechId)
    });
  }
  if (building.requiredPoiId) {
    rows.push({
      label: "POI requis",
      value: poiLabel(building.requiredPoiId)
    });
  }

  const recipe = getRecipeStepForBuilding(building.id);
  const input = recipe?.input ?? building.input;
  const output =
    (recipe?.output as ResourceId | string | null | undefined) ??
    building.output;

  if (input != null || building.role === "processor") {
    rows.push({
      label: "Entrée",
      value:
        input == null
          ? "—"
          : recipe?.inputCount && recipe.inputCount > 1
            ? `${recipe.inputCount} ${resourceLabel(input)}`
            : resourceLabel(input)
    });
  }

  if (output != null) {
    rows.push({
      label: "Sortie",
      value:
        recipe?.outputCount && recipe.outputCount > 1
          ? `${recipe.outputCount} ${resourceLabel(output)}`
          : resourceLabel(output)
    });
  }

  if (building.maxWorkers != null) {
    rows.push({
      label: "Ouvriers",
      value: String(building.maxWorkers)
    });
  }

  const rate = formatProductionRate(building);
  if (rate) {
    rows.push({ label: "Production", value: rate });
  }

  if (building.populationCapBonus != null) {
    rows.push({
      label: "Bonus pop.",
      value: `+${building.populationCapBonus} plafond`
    });
  }

  if (building.influenceRadius != null) {
    rows.push({
      label: "Emprise",
      value: `rayon ${building.influenceRadius}`
    });
  }

  rows.push({
    label: "Posable",
    value: building.placeable ? "Oui" : "Non"
  });

  return rows;
}

export function relatedBuildingIds(id: BuildingId): BuildingId[] {
  const def = getBuildingDefinition(id);
  if (!def) return [];
  const related = new Set<BuildingId>();
  const recipe = getRecipeStepForBuilding(id);

  for (const other of buildings) {
    if (other.id === id) continue;
    if (
      def.output &&
      other.input === def.output &&
      typeof def.output === "string"
    ) {
      related.add(other.id);
    }
    if (
      def.input &&
      other.output === def.input &&
      typeof def.input === "string"
    ) {
      related.add(other.id);
    }
    if (recipe?.output && other.input === recipe.output) {
      related.add(other.id);
    }
    if (recipe?.input && other.output === recipe.input) {
      related.add(other.id);
    }
  }

  return [...related].slice(0, 6);
}

/** Extrait le sommaire h2 depuis le body Nuxt Content. */
export function tocFromContentBody(body: unknown): { id: string; title: string }[] {
  if (!body || typeof body !== "object") return [];
  const toc = (body as { toc?: { links?: { id: string; text: string; depth: number }[] } })
    .toc;
  if (!toc?.links?.length) return [];
  return toc.links
    .filter((link) => link.depth <= 2)
    .map((link) => ({ id: link.id, title: link.text }));
}
