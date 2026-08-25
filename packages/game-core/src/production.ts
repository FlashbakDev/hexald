export type ProducerState = {
  stock: number;
  productionRatePerHour: number;
  lastCalculatedAt: number;
  cap?: number;
};

/** DEC-006 — pas de tick permanent. Recalcul lazy à la requête. */
export function applyOfflineProduction(
  producer: ProducerState,
  now: number
): ProducerState {
  const elapsedHours = Math.max(0, (now - producer.lastCalculatedAt) / 3_600_000);
  const produced = elapsedHours * producer.productionRatePerHour;
  const uncapped = producer.stock + produced;
  const stock = producer.cap === undefined ? uncapped : Math.min(producer.cap, uncapped);

  return {
    ...producer,
    stock,
    lastCalculatedAt: now
  };
}
