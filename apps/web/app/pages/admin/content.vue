<script setup lang="ts">
import {
  biomes,
  buildings,
  pois,
  resources,
  TECH_NODES,
  getBiomeDefinition,
  getBuildingDefinition,
  getPoiDefinition
} from "@hexald/content";
import type { BiomeId, BuildingId, PoiId } from "@hexald/shared";
import {
  ADMIN_PREVIEW_FOCUS,
  buildingHasMesh,
  previewViewSize,
  previewWorldForBiome,
  previewWorldForBuilding,
  previewWorldForPoi,
  type AdminPreviewWorld
} from "~/utils/adminContentPreview";
import {
  PROFILE_AVATAR_OPTIONS,
  type ProfileAvatarOption
} from "~/utils/profileAvatars";

definePageMeta({
  layout: "blank"
});

useHead({
  title: "Contenu · Admin · Hexald"
});

type CatalogTab =
  | "biomes"
  | "buildings"
  | "pois"
  | "resources"
  | "techs"
  | "avatars";

const tab = ref<CatalogTab>("biomes");
const selectedId = ref<string>(biomes[0]?.id ?? "forest");

const tabs: { id: CatalogTab; label: string; count: number }[] = [
  { id: "biomes", label: "Biomes", count: biomes.length },
  { id: "buildings", label: "Bâtiments", count: buildings.length },
  { id: "pois", label: "POI", count: pois.length },
  { id: "resources", label: "Ressources", count: resources.length },
  { id: "techs", label: "Techs", count: TECH_NODES.length },
  { id: "avatars", label: "Avatars", count: PROFILE_AVATAR_OPTIONS.length }
];

const listItems = computed(() => {
  switch (tab.value) {
    case "biomes":
      return biomes.map((b) => ({
        id: b.id,
        label: b.label,
        meta: b.primary ? "primaire" : "fusion",
        status: null as string | null
      }));
    case "buildings":
      return buildings.map((b) => ({
        id: b.id,
        label: b.label,
        meta: b.role,
        status: b.status
      }));
    case "pois":
      return pois.map((p) => ({
        id: p.id,
        label: p.label,
        meta: p.kind,
        status: p.status
      }));
    case "resources":
      return resources.map((r) => ({
        id: r.id,
        label: r.label,
        meta: null as string | null,
        status: null as string | null
      }));
    case "techs":
    case "avatars":
      return [];
    default:
      return [];
  }
});

watch(tab, () => {
  if (tab.value === "techs" || tab.value === "avatars") return;
  selectedId.value = listItems.value[0]?.id ?? "";
});

const previewWorld = computed<AdminPreviewWorld | null>(() => {
  const id = selectedId.value;
  if (!id) return null;
  if (tab.value === "biomes") return previewWorldForBiome(id as BiomeId);
  if (tab.value === "buildings") return previewWorldForBuilding(id as BuildingId);
  if (tab.value === "pois") return previewWorldForPoi(id as PoiId);
  return null;
});

const previewKey = computed(
  () => `${tab.value}:${selectedId.value}:${previewWorld.value?.tiles.length ?? 0}`
);

const previewView = computed(() =>
  previewViewSize(
    tab.value,
    tab.value === "biomes" ? selectedId.value : undefined
  )
);

const showPreview = computed(
  () => tab.value === "biomes" || tab.value === "buildings" || tab.value === "pois"
);

const showTechTree = computed(() => tab.value === "techs");
const showAvatars = computed(() => tab.value === "avatars");

const selectedAvatar = computed((): ProfileAvatarOption | null => {
  if (tab.value !== "avatars") return null;
  return (
    PROFILE_AVATAR_OPTIONS.find((a) => a.id === selectedId.value) ??
    PROFILE_AVATAR_OPTIONS[0] ??
    null
  );
});

watch(
  showAvatars,
  (on) => {
    if (on && !PROFILE_AVATAR_OPTIONS.some((a) => a.id === selectedId.value)) {
      selectedId.value = PROFILE_AVATAR_OPTIONS[0]?.id ?? "";
    }
  },
  { immediate: true }
);

const detail = computed(() => {
  const id = selectedId.value;
  if (!id || tab.value === "techs" || tab.value === "avatars") return null;

  if (tab.value === "biomes") {
    const b = getBiomeDefinition(id);
    if (!b) return null;
    return {
      title: b.label,
      id: b.id,
      description: b.description,
      rows: [
        ["Kind", b.kind],
        ["Primaire", b.primary ? "oui" : "non"]
      ] as [string, string][]
    };
  }

  if (tab.value === "buildings") {
    const b = getBuildingDefinition(id as BuildingId);
    if (!b) return null;
    const rows: [string, string][] = [
      ["Rôle", b.role],
      ["Statut", b.status],
      ["Terrain", String(b.terrain)],
      ["Posable", b.placeable ? "oui" : "non"],
      ["Mesh 3D", buildingHasMesh(b.id) ? "oui" : "non (catalogue seul)"],
      ["Entrée", b.input ?? "—"],
      ["Sortie", b.output ?? "—"],
      ["Emprise", String(b.hexSize)]
    ];
    if (b.woodCost != null) rows.push(["Coût bois", String(b.woodCost)]);
    if (b.buildDurationMs != null) {
      rows.push(["Chantier", `${Math.round(b.buildDurationMs / 1000)} s`]);
    }
    if (b.maxWorkers != null) rows.push(["Workers max", String(b.maxWorkers)]);
    if (b.ratePerWorkerPerMinute != null) {
      rows.push(["Rate / worker / min", String(b.ratePerWorkerPerMinute)]);
    }
    if (b.requiredPoiId) rows.push(["POI requis", b.requiredPoiId]);
    if (b.requiredTechId) rows.push(["Tech requise", b.requiredTechId]);
    if (b.populationCapBonus) {
      rows.push(["Bonus pop cap", `+${b.populationCapBonus}`]);
    }
    return {
      title: b.label,
      id: b.id,
      description: null as string | null,
      rows
    };
  }

  if (tab.value === "pois") {
    const p = getPoiDefinition(id as PoiId);
    if (!p) return null;
    return {
      title: p.label,
      id: p.id,
      description: p.description,
      rows: [
        ["Kind", p.kind],
        ["Statut", p.status],
        ["Biomes", p.biomes.join(", ")],
        ["Côte only", p.coastalWaterOnly ? "oui" : "non"]
      ] as [string, string][]
    };
  }

  if (tab.value === "resources") {
    const r = resources.find((x) => x.id === id);
    if (!r) return null;
    return {
      title: r.label,
      id: r.id,
      description: null as string | null,
      rows: [] as [string, string][]
    };
  }

  return null;
});

function statusClass(status: string | null) {
  if (!status) return "";
  if (status === "mvp" || status === "départ") return "bg-emerald-100 text-emerald-900";
  if (status === "planned") return "bg-amber-100 text-amber-950";
  if (status === "later") return "bg-slate-200 text-slate-700";
  return "bg-[#1c2b28]/08 text-[#3d524c]";
}
</script>

<template>
  <AdminAuthGate>
    <template #default="{ email }">
      <div class="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="font-display text-sm tracking-[0.18em] text-[#4a7c6f] uppercase">
              Hexald
            </p>
            <h1 class="font-display mt-1 text-3xl font-medium tracking-tight">
              Contenu du jeu
            </h1>
            <p class="mt-2 max-w-xl text-sm text-[#6b7c76]">
              Catalogue live depuis <code class="text-xs">@hexald/content</code>
              — preview 3D comme en jeu.
            </p>
            <p v-if="email" class="mt-1 text-xs text-[#6b7c76]">{{ email }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="soft" to="/admin">
              Ops
            </UButton>
            <UButton color="neutral" variant="ghost" to="/">
              Jeu
            </UButton>
          </div>
        </header>

        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
            :class="
              tab === t.id
                ? 'bg-[#2d5248] text-[#f2f7f4]'
                : 'bg-white/70 text-[#3d524c] hover:bg-white'
            "
            @click="tab = t.id"
          >
            {{ t.label }}
            <span class="ml-1 opacity-70">{{ t.count }}</span>
          </button>
        </div>

        <div
          v-if="showTechTree"
          class="min-h-0 flex-1"
        >
          <TechTimelinePanel embedded />
        </div>

        <div
          v-else-if="showAvatars"
          class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]"
        >
          <section
            class="rounded-2xl border border-[#1c2b28]/10 bg-white/65 p-4 backdrop-blur-sm sm:p-5"
          >
            <p class="mb-3 text-sm text-[#6b7c76]">
              Portraits low-poly · clés = pseudos guests (
              <code class="text-xs">PROFILE_AVATAR_IDS</code>).
            </p>
            <div
              class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5"
            >
              <button
                v-for="avatar in PROFILE_AVATAR_OPTIONS"
                :key="avatar.id"
                type="button"
                class="flex flex-col items-center gap-2 rounded-xl p-2.5 text-center transition"
                :class="
                  selectedId === avatar.id
                    ? 'bg-[#2d5248]/10 ring-1 ring-[#4a7c6f]/35'
                    : 'hover:bg-white/80'
                "
                @click="selectedId = avatar.id"
              >
                <span
                  class="block size-16 rounded-full border border-[#1c2b28]/12 bg-[#e8f0ec] bg-cover bg-center shadow-sm sm:size-[4.5rem]"
                  :style="{ backgroundImage: `url(${avatar.src})` }"
                />
                <span class="w-full truncate text-xs font-medium text-[#1c2b28]">
                  {{ avatar.label }}
                </span>
              </button>
            </div>
          </section>

          <article
            v-if="selectedAvatar"
            class="flex flex-col items-center rounded-2xl border border-[#1c2b28]/10 bg-white/65 p-5 text-center backdrop-blur-sm"
          >
            <span
              class="mb-4 block size-36 rounded-full border-2 border-[#4a7c6f]/35 bg-[#e8f0ec] bg-cover bg-center shadow-md"
              :style="{ backgroundImage: `url(${selectedAvatar.src})` }"
            />
            <h2 class="font-display text-2xl font-medium tracking-tight">
              {{ selectedAvatar.label }}
            </h2>
            <code class="mt-1 block text-xs text-[#6b7c76]">{{ selectedAvatar.id }}</code>
            <dl class="mt-4 w-full space-y-2 text-left">
              <div class="rounded-lg bg-[#e8f0ec]/80 px-3 py-2">
                <dt class="text-[11px] tracking-wide text-[#6b7c76] uppercase">
                  Clé guest
                </dt>
                <dd class="mt-0.5 text-sm text-[#1c2b28]">
                  {{ selectedAvatar.id }}42
                </dd>
              </div>
              <div class="rounded-lg bg-[#e8f0ec]/80 px-3 py-2">
                <dt class="text-[11px] tracking-wide text-[#6b7c76] uppercase">
                  Fichier
                </dt>
                <dd class="mt-0.5 break-all text-sm text-[#1c2b28]">
                  {{ selectedAvatar.file }}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <div
          v-else
          class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
        >
          <aside
            class="max-h-[min(70vh,640px)] overflow-y-auto rounded-2xl border border-[#1c2b28]/10 bg-white/55 p-2 backdrop-blur-sm"
          >
            <button
              v-for="item in listItems"
              :key="item.id"
              type="button"
              class="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition"
              :class="
                selectedId === item.id
                  ? 'bg-[#2d5248]/10 ring-1 ring-[#4a7c6f]/35'
                  : 'hover:bg-white/80'
              "
              @click="selectedId = item.id"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-[#1c2b28]">
                  {{ item.label }}
                </div>
                <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <code class="truncate text-[11px] text-[#6b7c76]">{{ item.id }}</code>
                  <span
                    v-if="item.meta"
                    class="rounded-full bg-[#1c2b28]/06 px-1.5 py-0.5 text-[10px] text-[#3d524c]"
                  >
                    {{ item.meta }}
                  </span>
                  <span
                    v-if="item.status"
                    class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    :class="statusClass(item.status)"
                  >
                    {{ item.status }}
                  </span>
                </div>
              </div>
            </button>
          </aside>

          <section class="flex min-h-0 flex-col gap-4">
            <div
              v-if="showPreview"
              class="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#1c2b28]/10 bg-[#c5d4cc] shadow-[inset_0_0_40px_rgb(28_43_40_/_0.06)]"
            >
              <ClientOnly>
                <div v-if="previewWorld" class="absolute inset-0">
                  <HexPreview
                    :key="previewKey"
                    class="!block size-full"
                    :initial-world="previewWorld"
                    :look-at="ADMIN_PREVIEW_FOCUS"
                    :view-size="previewView"
                    :frame-bias-y="0.12"
                    :fog-clear-region-padding="1"
                    :device-tilt="false"
                  />
                </div>
                <template #fallback>
                  <div class="flex h-full items-center justify-center text-sm text-[#6b7c76]">
                    Chargement 3D…
                  </div>
                </template>
              </ClientOnly>
              <p
                v-if="tab === 'buildings' && selectedId && !buildingHasMesh(selectedId as BuildingId)"
                class="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-[#1c2b28]/75 px-3 py-2 text-xs text-[#f2f7f4]"
              >
                Pas de mesh 3D pour ce bâtiment — tuile terrain seule.
              </p>
            </div>

            <div
              v-else
              class="flex aspect-[16/10] max-h-48 items-center justify-center rounded-2xl border border-dashed border-[#1c2b28]/15 bg-white/40 text-sm text-[#6b7c76]"
            >
              Pas de preview 3D pour cette catégorie
            </div>

            <article
              v-if="detail"
              class="rounded-2xl border border-[#1c2b28]/10 bg-white/65 p-5 backdrop-blur-sm"
            >
              <h2 class="font-display text-2xl font-medium tracking-tight">
                {{ detail.title }}
              </h2>
              <code class="mt-1 block text-xs text-[#6b7c76]">{{ detail.id }}</code>
              <p v-if="detail.description" class="mt-3 text-sm leading-relaxed text-[#3d524c]">
                {{ detail.description }}
              </p>
              <dl
                v-if="detail.rows.length"
                class="mt-4 grid gap-2 sm:grid-cols-2"
              >
                <div
                  v-for="[k, v] in detail.rows"
                  :key="k"
                  class="rounded-lg bg-[#e8f0ec]/80 px-3 py-2"
                >
                  <dt class="text-[11px] tracking-wide text-[#6b7c76] uppercase">
                    {{ k }}
                  </dt>
                  <dd class="mt-0.5 text-sm text-[#1c2b28]">{{ v }}</dd>
                </div>
              </dl>
            </article>
          </section>
        </div>
      </div>
    </template>
  </AdminAuthGate>
</template>
