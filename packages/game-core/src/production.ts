export type ProducerState = {
  stock: number;
  /** Unités produites par minute. */
  productionRatePerMinute: number;
  lastCalculatedAt: number;
  cap?: number;
};

/** DEC-006 — pas de tick permanent. Recalcul lazy à la requête. */
export function applyOfflineProduction(
  producer: ProducerState,
  now: number
): ProducerState {
  const elapsedMinutes = Math.max(0, (now - producer.lastCalculatedAt) / 60_000);
  const produced = elapsedMinutes * producer.productionRatePerMinute;
  const uncapped = producer.stock + produced;
  const stock = producer.cap === undefined ? uncapped : Math.min(producer.cap, uncapped);

  return {
    ...producer,
    stock,
    lastCalculatedAt: now
  };
}
