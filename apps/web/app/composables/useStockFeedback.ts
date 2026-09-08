import type { ResourceId } from "@hexald/shared";

export type StockFeedbackPulse = {
  resourceId: ResourceId;
  /** Epoch ms — pour rejouer l’anim à chaque pulse. */
  at: number;
};

export type StockFeedbackFloater = {
  key: number;
  resourceId: ResourceId;
  delta: number;
};

type StockSnapshot = Partial<Record<ResourceId, number>>;

/**
 * Feedback léger sur variation de stocks snapshot.
 * - Pas de faux gain au premier chargement
 * - Pas de spam de floaters après gros settle offline
 */
export function useStockFeedback() {
  const previous = ref<StockSnapshot | null>(null);
  const pulses = ref<StockFeedbackPulse[]>([]);
  const floaters = ref<StockFeedbackFloater[]>([]);
  let floaterKey = 0;
  let floaterTimers: number[] = [];

  const reducedMotion = ref(false);
  let motionMq: MediaQueryList | null = null;
  let motionOnChange: (() => void) | null = null;

  function readReducedMotion() {
    if (!import.meta.client) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  onMounted(() => {
    reducedMotion.value = readReducedMotion();
    motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionOnChange = () => {
      reducedMotion.value = motionMq?.matches ?? false;
    };
    motionMq.addEventListener("change", motionOnChange);
  });

  onUnmounted(() => {
    if (motionMq && motionOnChange) {
      motionMq.removeEventListener("change", motionOnChange);
    }
    motionMq = null;
    motionOnChange = null;
    for (const id of floaterTimers) window.clearTimeout(id);
    floaterTimers = [];
  });

  function clearPulsesSoon(at: number) {
    if (!import.meta.client || reducedMotion.value) return;
    window.setTimeout(() => {
      pulses.value = pulses.value.filter((p) => p.at !== at);
    }, 650);
  }

  function pushFloater(resourceId: ResourceId, delta: number) {
    if (reducedMotion.value) return;
    const key = ++floaterKey;
    floaters.value = [...floaters.value, { key, resourceId, delta }];
    const timer = window.setTimeout(() => {
      floaters.value = floaters.value.filter((f) => f.key !== key);
      floaterTimers = floaterTimers.filter((t) => t !== timer);
    }, 1100);
    floaterTimers.push(timer);
  }

  /**
   * Appeler avec les montants affichés (floor) après chaque snapshot utile.
   * Au premier appel : mémorise la baseline sans feedback.
   */
  function ingest(next: StockSnapshot) {
    const floored: StockSnapshot = {};
    for (const [id, raw] of Object.entries(next) as [ResourceId, number][]) {
      floored[id] = Math.floor(raw ?? 0);
    }

    if (!previous.value) {
      previous.value = floored;
      return;
    }

    const deltas: { resourceId: ResourceId; delta: number }[] = [];
    const ids = new Set([
      ...Object.keys(previous.value),
      ...Object.keys(floored)
    ]) as Set<ResourceId>;

    for (const resourceId of ids) {
      const before = previous.value[resourceId] ?? 0;
      const after = floored[resourceId] ?? 0;
      const delta = after - before;
      if (delta !== 0) deltas.push({ resourceId, delta });
    }

    previous.value = floored;
    if (deltas.length === 0) return;

    const at = Date.now();
    pulses.value = deltas.map((d) => ({ resourceId: d.resourceId, at }));
    clearPulsesSoon(at);

    // Gros settle : beaucoup de lignes ou un énorme delta → pulse seul, pas de +N spam.
    const bigDump =
      deltas.length >= 4 ||
      deltas.some((d) => Math.abs(d.delta) >= 40);
    if (bigDump || reducedMotion.value) return;

    for (const d of deltas) {
      pushFloater(d.resourceId, d.delta);
    }
  }

  /** Reset baseline (ex. reset monde) pour éviter un faux delta. */
  function resetBaseline() {
    previous.value = null;
    pulses.value = [];
    floaters.value = [];
  }

  function isPulsing(resourceId: ResourceId): boolean {
    return pulses.value.some((p) => p.resourceId === resourceId);
  }

  function pulseAt(resourceId: ResourceId): number | null {
    return pulses.value.find((p) => p.resourceId === resourceId)?.at ?? null;
  }

  return {
    pulses,
    floaters,
    ingest,
    resetBaseline,
    isPulsing,
    pulseAt,
    reducedMotion
  };
}
