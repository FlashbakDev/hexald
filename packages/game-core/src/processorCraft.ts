import {

  DEV_CRAFT_DURATION_MS,

  SAWMILL_CRAFT_DURATION_MS,

  getProcessorStepForBuilding,

  recipeInputCount,

  recipeOutputCount,

  stockCapFor,

  type PlaceableProcessorId

} from "@hexald/content";

import type { BuildingId } from "@hexald/shared";

import { isBuildingComplete } from "./construction.ts";
import { isPlaceableProcessor } from "./build.ts";
import { computeInfluencedTiles } from "./influence.ts";
import {
  getStock,
  setStock,
  type EconomyState
} from "./economy.ts";



export type ProcessorTileState = {

  q: number;

  r: number;

  buildingId?: BuildingId | null;

  assignedWorkers?: number;

  constructionCompletesAt?: number | string | Date | null;

  /**

   * Pendant un craft : nombre de planches (output) réservées à la livraison.

   * Idle : 0.

   */

  processorInputBuffer?: number;

  /** ms epoch — fin du craft en cours ; null = idle. */

  craftCompletesAt?: number | null;

  /** Legacy valve — ignorée (conservée pour compat snapshot). */

  processorInputRatePerMinute?: number;

  processorInputSettledAt?: number | null;

};



export type SettleProcessorsOptions = {

  /** Accélère les crafts (mode debug). */

  accelerate?: boolean;

};



function parseTime(value: number | string | Date | null | undefined): number | null {

  if (value == null) return null;

  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (value instanceof Date) {

    const ms = value.getTime();

    return Number.isFinite(ms) ? ms : null;

  }

  const ms = Date.parse(value);

  return Number.isNaN(ms) ? null : ms;

}



function craftDurationMs(

  buildingId: PlaceableProcessorId,

  accelerate: boolean

): number {

  if (accelerate) return DEV_CRAFT_DURATION_MS;

  if (buildingId === "sawmill") return SAWMILL_CRAFT_DURATION_MS;

  return SAWMILL_CRAFT_DURATION_MS;

}



/**

 * Ouvriers assignés = unités d’output par cycle (scierie L1 : 0 ou 1 planche).

 */

function outputUnitsForCycle(

  buildingId: PlaceableProcessorId,

  workers: number

): number {

  if (buildingId === "sawmill") return Math.max(0, workers);

  return Math.max(0, workers);

}



function settleOneProcessorTile<T extends ProcessorTileState>(
  state: EconomyState,
  tile: T,
  now: number,
  accelerate: boolean,
  influenced: ReadonlySet<string>
): { state: EconomyState; tile: T; changed: boolean } {
  const buildingId = tile.buildingId;
  if (!buildingId || !isPlaceableProcessor(buildingId)) {
    return { state, tile, changed: false };
  }
  if (!isBuildingComplete(tile.constructionCompletesAt, now)) {
    return { state, tile, changed: false };
  }

  const key = `${tile.q},${tile.r}`;
  if (!influenced.has(key)) {
    const workers = tile.assignedWorkers ?? 0;
    const buffer = tile.processorInputBuffer ?? 0;
    const craft = tile.craftCompletesAt ?? null;
    if (workers <= 0 && buffer <= 0 && craft == null) {
      return { state, tile, changed: false };
    }
    return {
      state,
      tile: {
        ...tile,
        assignedWorkers: 0,
        processorInputBuffer: 0,
        craftCompletesAt: null
      },
      changed: true
    };
  }

  const step = getProcessorStepForBuilding(buildingId);
  if (!step?.input) return { state, tile, changed: false };



  const inputId = step.input;

  const outputId = step.output;

  const inPerUnit = recipeInputCount(step);

  const outPerUnit = recipeOutputCount(step);

  const duration = craftDurationMs(buildingId, accelerate);

  const workers = Math.max(0, Math.floor(tile.assignedWorkers ?? 0));



  let pendingOut = Math.max(0, Math.floor(tile.processorInputBuffer ?? 0));

  let craftEnd = parseTime(tile.craftCompletesAt ?? null);

  let next = state;

  let changed = false;

  /** Horloge pour enchaîner les cycles offline. */

  let clock = craftEnd != null && craftEnd <= now ? craftEnd : now;



  for (let iter = 0; iter < 64; iter += 1) {

    if (craftEnd != null && craftEnd <= now) {

      const outStock = getStock(next, outputId);

      const cap = stockCapFor(outputId);

      const add = Math.min(

        pendingOut * outPerUnit,

        Math.max(0, cap - outStock.amount)

      );

      next = setStock(next, outputId, {

        amount: outStock.amount + add,

        lastCalculatedAt: craftEnd

      });

      clock = craftEnd;

      craftEnd = null;

      pendingOut = 0;

      changed = true;

      continue;

    }



    if (craftEnd != null) {

      // Craft encore en cours dans le futur.

      break;

    }



    const units = outputUnitsForCycle(buildingId, workers);

    if (units <= 0) break;



    const woodNeed = units * inPerUnit;

    const inStock = getStock(next, inputId);

    const outStock = getStock(next, outputId);

    const cap = stockCapFor(outputId);

    const room = Math.max(0, Math.floor(cap - outStock.amount));

    if (inStock.amount + 1e-9 < woodNeed || room < units * outPerUnit) {

      break;

    }



    next = setStock(next, inputId, {

      amount: Math.max(0, inStock.amount - woodNeed),

      lastCalculatedAt: clock

    });

    pendingOut = units;

    craftEnd = clock + duration;

    changed = true;



    if (craftEnd <= now) {

      continue;

    }

    break;

  }



  const nextTile: T = {

    ...tile,

    processorInputBuffer: pendingOut,

    craftCompletesAt: craftEnd,

    processorInputRatePerMinute: 0,

    processorInputSettledAt: null

  };



  const tileChanged =

    changed ||

    Math.floor(tile.processorInputBuffer ?? 0) !== pendingOut ||

    parseTime(tile.craftCompletesAt ?? null) !== craftEnd;



  return { state: next, tile: nextTile, changed: tileChanged };

}



/**

 * Settle processors : ouvriers → output / cycle, input pris dans la réserve globale.

 * Scierie L1 : 1 ouvrier → 1 planche / 2 min (si assez de bois).

 */

export function settleProcessorTiles<T extends ProcessorTileState>(
  state: EconomyState,
  tiles: readonly T[],
  now: number,
  options: SettleProcessorsOptions = {}
): { state: EconomyState; tiles: T[]; changed: boolean } {
  const accelerate = options.accelerate === true;
  const influenced = computeInfluencedTiles(tiles, now);
  let next = state;
  let anyChanged = false;
  const out: T[] = [];

  for (const tile of tiles) {
    const result = settleOneProcessorTile(next, tile, now, accelerate, influenced);
    next = result.state;
    out.push(result.tile);
    if (result.changed) anyChanged = true;
  }

  return { state: next, tiles: out, changed: anyChanged };
}



/** @deprecated Valve retirée — toujours 0. */

export function maxProcessorInputRate(_buildingId: BuildingId): number {

  return 0;

}



/** @deprecated Valve retirée — toujours 0. */

export function clampProcessorInputRate(

  _buildingId: BuildingId,

  _rate: number

): number {

  return 0;

}


