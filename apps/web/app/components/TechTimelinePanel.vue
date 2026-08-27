<script setup lang="ts">
import {
  getTechNode,
  isResearchableTechId,
  TECH_NODES,
  techDisplayIndex,
  type TechId,
  type TechNodeDefinition,
  type TechPrototypeStatus
} from "@hexald/content";
import type { WorldResearchSnapshot } from "@hexald/shared";

const open = defineModel<boolean>("open", { default: false });

const props = withDefaults(
  defineProps<{
    research?: WorldResearchSnapshot | null;
    selecting?: boolean;
    unlockNotice?: string | null;
    /** Inline (ex. admin catalogue) — pas de sheet overlay / fermeture. */
    embedded?: boolean;
  }>(),
  {
    research: null,
    selecting: false,
    unlockNotice: null,
    embedded: false
  }
);

const visible = computed(() => props.embedded || open.value);

const emit = defineEmits<{
  "select-tech": [techId: TechId];
}>();

const RING_RADIUS = 17;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ringDashoffset(percent: number): number {
  return RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, percent)) / 100);
}

type LayoutColumn = {
  depth: number;
  nodes: TechNodeDefinition[];
};

type EdgePath = {
  from: TechId;
  to: TechId;
  d: string;
  lit: boolean;
};

const graphEl = ref<HTMLElement | null>(null);
const trackEl = ref<HTMLElement | null>(null);
const nodeEls = new Map<TechId, HTMLElement>();
const edgePaths = ref<EdgePath[]>([]);
const graphSize = ref({ w: 0, h: 0 });

function setNodeRef(id: TechId, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) nodeEls.set(id, el);
  else nodeEls.delete(id);
}

function computeDepths(): Map<TechId, number> {
  const cache = new Map<TechId, number>();
  const visit = (id: TechId): number => {
    if (cache.has(id)) return cache.get(id)!;
    const node = getTechNode(id);
    if (node.prerequisites.length === 0) {
      cache.set(id, 0);
      return 0;
    }
    const depth = Math.max(...node.prerequisites.map(visit)) + 1;
    cache.set(id, depth);
    return depth;
  };
  for (const node of TECH_NODES) visit(node.id);
  return cache;
}

const layoutColumns = computed((): LayoutColumn[] => {
  const depths = computeDepths();
  const byDepth = new Map<number, TechNodeDefinition[]>();
  for (const node of TECH_NODES) {
    const depth = depths.get(node.id) ?? 0;
    const bucket = byDepth.get(depth) ?? [];
    bucket.push(node);
    byDepth.set(depth, bucket);
  }
  return [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, nodes]) => ({
      depth,
      nodes: [...nodes].sort(
        (a, b) =>
          techDisplayIndex(a.id) - techDisplayIndex(b.id) ||
          a.label.localeCompare(b.label, "fr")
      )
    }));
});

const edges = computed(() => {
  const list: { from: TechId; to: TechId }[] = [];
  for (const node of TECH_NODES) {
    for (const pre of node.prerequisites) {
      list.push({ from: pre, to: node.id });
    }
  }
  return list;
});

function statusFor(id: TechId): TechPrototypeStatus {
  if (props.embedded) return "available";
  const research = props.research;
  if (!research) {
    return id === "foundations" ? "unlocked" : "locked";
  }
  if (research.unlockedTechIds.includes(id)) return "unlocked";
  if (research.researchTargetTechId === id) return "researching";
  const node = getTechNode(id);
  if (
    isResearchableTechId(id) &&
    node.prerequisites.every((pre) => research.unlockedTechIds.includes(pre))
  ) {
    return "available";
  }
  return "locked";
}

function nodeStatusClass(id: TechId): string {
  if (props.embedded) return "tech-frise__node--neutral";
  return `tech-frise__node--${statusFor(id)}`;
}

function progressFor(id: TechId): { progress: number; cost: number; percent: number } {
  const entry = props.research?.techProgress.find((row) => row.techId === id);
  const cost = entry?.scienceCost ?? getTechNode(id).scienceCost;
  const progress = entry?.progress ?? 0;
  const percent =
    statusFor(id) === "unlocked"
      ? 100
      : cost > 0
        ? Math.min(100, Math.round((progress / cost) * 100))
        : 0;
  return { progress, cost, percent };
}

function formatResearchEta(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "< 1 min";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${Math.ceil(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins <= 0) return `~${hours} h`;
  return `~${hours} h ${mins} min`;
}

/** Science restante + ETA selon la prod HDV actuelle. */
function scienceMetaFor(id: TechId): {
  costLabel: string;
  etaLabel: string | null;
  line: string;
} {
  const status = statusFor(id);
  const { progress, cost } = progressFor(id);
  if (cost <= 0) {
    return { costLabel: "—", etaLabel: null, line: "—" };
  }
  if (status === "unlocked") {
    const costLabel = `${cost} science`;
    return { costLabel, etaLabel: null, line: costLabel };
  }

  const remaining = Math.max(0, cost - progress);
  const costLabel =
    progress > 0 ? `${Math.floor(progress)}/${cost}` : `${cost} science`;
  const rate = props.research?.scienceProductionPerMinute ?? 0;
  if (rate <= 0) {
    return { costLabel, etaLabel: null, line: costLabel };
  }
  const etaLabel = formatResearchEta(remaining / rate);
  return { costLabel, etaLabel, line: `${costLabel} · ${etaLabel}` };
}

const prodLabel = computed(() => {
  const rate = props.research?.scienceProductionPerMinute ?? 0;
  if (rate <= 0) return "0 / min";
  if (rate >= 1) return `+${rate.toFixed(1)} / min`;
  return `+${rate.toFixed(2)} / min`;
});

const pauseHint = computed(() => {
  if (props.embedded) return null;
  if (props.research?.researchTargetTechId) return null;
  const hasAvailable = TECH_NODES.some((node) => statusFor(node.id) === "available");
  if (hasAvailable) {
    return "En pause — choisis une technologie pour utiliser la production HDV.";
  }
  return null;
});

function close() {
  if (props.embedded) return;
  open.value = false;
}

function onSelectTech(id: TechId) {
  if (props.embedded) return;
  if (statusFor(id) !== "available" || props.selecting) return;
  emit("select-tech", id);
}

function ctaTitle(id: TechId): string {
  const node = getTechNode(id);
  if (props.embedded) {
    const cost =
      node.scienceCost > 0 ? `${node.scienceCost} science` : "départ";
    return `${node.label} · ${cost} · ${node.unlocksLabel}`;
  }
  const status = statusFor(id);
  const meta = scienceMetaFor(id);
  if (status === "locked") return `${node.label} · prérequis manquants · ${meta.line}`;
  if (status === "unlocked") return `${node.label} · acquise · ${node.unlocksLabel}`;
  if (status === "researching") return `${node.label} · en cours · ${meta.line}`;
  const active = props.research?.researchTargetTechId;
  if (active && active !== id) {
    return `${node.label} · changer de cible · ${meta.line}`;
  }
  return `${node.label} · ${meta.line} · ${node.unlocksLabel}`;
}

const EDGE_RADIUS = 10;

type Point = { x: number; y: number };

/** Polyligne orthogonale avec coins cubiques arrondis (κ ≈ 0.552). */
function filletPolyline(points: Point[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.5 || len2 < 0.5) continue;

    const r = Math.min(radius, len1 / 2, len2 / 2);
    if (r < 2.5) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;
    const p1x = curr.x - n1x * r;
    const p1y = curr.y - n1y * r;
    const p2x = curr.x + n2x * r;
    const p2y = curr.y + n2y * r;
    const k = r * 0.5522847498;

    d += ` L ${p1x} ${p1y}`;
    d += ` C ${p1x + n1x * k} ${p1y + n1y * k} ${p2x - n2x * k} ${p2y - n2y * k} ${p2x} ${p2y}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function buildEdgePath(start: Point, end: Point): string {
  const span = end.x - start.x;
  if (span <= 4) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const dy = end.y - start.y;
  if (Math.abs(dy) < 4) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  // Bus vertical unique au centre de l’entre-colonnes (style Civ, pas de couloirs décalés).
  const midX = start.x + span * 0.5;
  const radius = Math.min(EDGE_RADIUS, span * 0.18, Math.abs(dy) / 2 - 0.5);

  return filletPolyline(
    [
      { x: start.x, y: start.y },
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      { x: end.x, y: end.y }
    ],
    Math.max(3, radius)
  );
}

function nodeAnchor(
  el: HTMLElement,
  side: "left" | "right",
  graphRect: DOMRect
): { x: number; y: number } {
  const box = el.getBoundingClientRect();
  const portrait = el.querySelector<HTMLElement>(".tech-frise__portrait");
  const focus = portrait?.getBoundingClientRect() ?? box;
  return {
    x: side === "right" ? box.right - graphRect.left : box.left - graphRect.left,
    y: focus.top + focus.height / 2 - graphRect.top
  };
}

function updateEdgePaths() {
  const track = trackEl.value;
  if (!track) return;

  const rect = track.getBoundingClientRect();
  graphSize.value = {
    w: Math.max(1, Math.round(track.scrollWidth)),
    h: Math.max(1, Math.round(track.offsetHeight))
  };

  const unlocked = new Set(
    props.embedded
      ? TECH_NODES.map((n) => n.id)
      : (props.research?.unlockedTechIds ?? ["foundations"])
  );
  const next: EdgePath[] = [];

  for (const { from, to } of edges.value) {
    const fromEl = nodeEls.get(from);
    const toEl = nodeEls.get(to);
    if (!fromEl || !toEl) continue;

    const start = nodeAnchor(fromEl, "right", rect);
    const end = nodeAnchor(toEl, "left", rect);

    next.push({
      from,
      to,
      d: buildEdgePath(start, end),
      lit: unlocked.has(from)
    });
  }

  edgePaths.value = next;
}

let resizeObserver: ResizeObserver | null = null;

function onGraphWheel(event: WheelEvent) {
  const graph = graphEl.value;
  if (!graph) return;
  if (graph.scrollWidth <= graph.clientWidth + 1) return;
  // Molette verticale → scroll horizontal de la frise.
  if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
  if (event.deltaY === 0) return;
  event.preventDefault();
  graph.scrollLeft += event.deltaY;
}

function bindGraphObserver() {
  resizeObserver?.disconnect();
  resizeObserver = null;

  const graph = graphEl.value;
  const track = trackEl.value;
  if (!graph || !track) return;

  graph.removeEventListener("wheel", onGraphWheel);
  graph.addEventListener("wheel", onGraphWheel, { passive: false });

  resizeObserver = new ResizeObserver(() => updateEdgePaths());
  resizeObserver.observe(track);
  resizeObserver.observe(graph);
  nextTick(() => {
    updateEdgePaths();
    requestAnimationFrame(() => updateEdgePaths());
  });
}

watch(visible, async (isVisible) => {
  if (!isVisible) return;
  await nextTick();
  bindGraphObserver();
});

watch(
  () => [props.research, layoutColumns.value.length] as const,
  async () => {
    if (!visible.value) return;
    await nextTick();
    updateEdgePaths();
  },
  { deep: true }
);

onMounted(async () => {
  if (!visible.value) return;
  await nextTick();
  bindGraphObserver();
});

onBeforeUnmount(() => {
  graphEl.value?.removeEventListener("wheel", onGraphWheel);
  resizeObserver?.disconnect();
});
</script>

<template>
  <Transition name="building-sheet">
    <aside
      v-if="visible"
      class="building-sheet tech-frise-sheet"
      :class="
        embedded
          ? 'tech-frise-sheet--embedded pointer-events-auto relative'
          : 'pointer-events-none absolute inset-x-0 z-40'
      "
      role="region"
      aria-label="Arbre technologique"
    >
      <div class="building-sheet__sky" aria-hidden="true">
        <svg
          class="building-sheet__svg"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              :id="embedded ? 'admin-cloud-tech-fill' : 'play-cloud-tech-fill'"
              x1="50%"
              y1="100%"
              x2="50%"
              y2="0%"
            >
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="35%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="55%" stop-color="#ffffff" stop-opacity="0.7" />
              <stop offset="75%" stop-color="#ffffff" stop-opacity="0.28" />
              <stop offset="90%" stop-color="#ffffff" stop-opacity="0.06" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <filter
              :id="embedded ? 'admin-cloud-tech-soft' : 'play-cloud-tech-soft'"
              x="-6%"
              y="-35%"
              width="112%"
              height="180%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
            </filter>
          </defs>
          <path
            :fill="`url(#${embedded ? 'admin-cloud-tech-fill' : 'play-cloud-tech-fill'})`"
            :filter="`url(#${embedded ? 'admin-cloud-tech-soft' : 'play-cloud-tech-soft'})`"
            d="M0 160H1200V100
              C1165 100 1135 82 1080 70
              C1010 54 970 42 900 50
              C850 56 820 68 760 58
              C700 48 660 36 590 46
              C530 54 500 66 440 50
              C380 34 330 32 270 48
              C210 62 170 74 100 80
              C50 86 18 94 0 98
              Z"
          />
          <rect x="0" y="108" width="1200" height="52" fill="#ffffff" />
        </svg>
        <div class="building-sheet__puff building-sheet__puff--1" />
        <div class="building-sheet__puff building-sheet__puff--2" />
        <div class="building-sheet__puff building-sheet__puff--3" />
        <div class="building-sheet__puff building-sheet__puff--4" />
        <div class="building-sheet__puff building-sheet__puff--5" />
        <div class="building-sheet__puff building-sheet__puff--6" />
      </div>

      <div class="building-sheet__content tech-frise-sheet__content pointer-events-auto">
        <div class="tech-frise-sheet__head">
          <div class="min-w-0">
            <p class="building-sheet__title">Technologies</p>
            <p v-if="!embedded" class="tech-frise-sheet__prod">
              <UIcon name="i-lucide-flask-conical" class="size-3.5 shrink-0" aria-hidden="true" />
              HDV {{ prodLabel }}
            </p>
            <p v-else class="tech-frise-sheet__prod">
              Arbre live · {{ layoutColumns.reduce((n, c) => n + c.nodes.length, 0) }} techs
            </p>
          </div>
          <button
            v-if="!embedded"
            type="button"
            class="building-sheet__close"
            aria-label="Fermer les technologies"
            @click="close"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>

        <p v-if="unlockNotice" class="tech-frise-sheet__notice tech-frise-sheet__notice--unlock">
          {{ unlockNotice }}
        </p>
        <p v-else-if="pauseHint" class="tech-frise-sheet__notice tech-frise-sheet__notice--pause">
          {{ pauseHint }}
        </p>

        <div ref="graphEl" class="tech-frise__graph">
          <div ref="trackEl" class="tech-frise__track">
            <svg
              class="tech-frise__edges"
              :width="graphSize.w"
              :height="graphSize.h"
              aria-hidden="true"
            >
              <path
                v-for="edge in edgePaths"
                :key="`${edge.from}-${edge.to}`"
                class="tech-frise__edge"
                :class="{ 'tech-frise__edge--lit': edge.lit }"
                :d="edge.d"
              />
            </svg>

            <div class="tech-frise__columns">
            <div
              v-for="column in layoutColumns"
              :key="column.depth"
              class="tech-frise__column"
            >
              <button
                v-for="node in column.nodes"
                :key="node.id"
                :ref="(el) => setNodeRef(node.id, el)"
                type="button"
                class="tech-frise__node"
                :class="nodeStatusClass(node.id)"
                :title="ctaTitle(node.id)"
                :aria-label="ctaTitle(node.id)"
                :disabled="
                  embedded || statusFor(node.id) !== 'available' || selecting
                "
                @click="onSelectTech(node.id)"
              >
                <div class="tech-frise__node-main">
                  <div class="tech-frise__portrait">
                    <svg
                      class="tech-frise__ring"
                      viewBox="0 0 40 40"
                      aria-hidden="true"
                    >
                      <circle
                        class="tech-frise__ring-track"
                        cx="20"
                        cy="20"
                        :r="RING_RADIUS"
                      />
                      <circle
                        v-if="!embedded && node.scienceCost > 0"
                        class="tech-frise__ring-fill"
                        :class="{
                          'tech-frise__ring-fill--active':
                            statusFor(node.id) === 'researching',
                          'tech-frise__ring-fill--done':
                            statusFor(node.id) === 'unlocked'
                        }"
                        cx="20"
                        cy="20"
                        :r="RING_RADIUS"
                        :stroke-dasharray="`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`"
                        :stroke-dashoffset="
                          ringDashoffset(progressFor(node.id).percent)
                        "
                      />
                    </svg>
                    <span class="tech-frise__portrait-icon" aria-hidden="true">
                      <UIcon :name="node.icon" class="size-5" />
                    </span>
                    <span
                      v-if="!embedded && statusFor(node.id) === 'unlocked'"
                      class="tech-frise__node-check"
                      aria-hidden="true"
                    >
                      <UIcon name="i-lucide-check" class="size-2.5" />
                    </span>
                  </div>
                  <div class="tech-frise__node-body">
                    <h3 class="tech-frise__node-title">{{ node.label }}</h3>
                    <p
                      v-if="
                        node.scienceCost > 0 &&
                        (embedded || statusFor(node.id) !== 'unlocked')
                      "
                      class="tech-frise__node-meta"
                    >
                      {{
                        embedded
                          ? `${node.scienceCost} science`
                          : scienceMetaFor(node.id).line
                      }}
                    </p>
                    <div
                      v-if="node.unlocks.length > 0"
                      class="tech-frise__unlocks"
                    >
                      <span
                        v-for="unlock in node.unlocks"
                        :key="`${node.id}-${unlock.refId}`"
                        class="tech-frise__unlock"
                        :class="`tech-frise__unlock--${unlock.kind}`"
                        :title="unlock.label"
                      >
                        <UIcon :name="unlock.icon" class="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </Transition>
</template>
