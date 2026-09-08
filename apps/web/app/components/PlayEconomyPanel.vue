<script setup lang="ts">
import type { BuildingId, ResourceId, TechId } from "@hexald/shared";
import {
  buildEconomyPanelChains,
  type EconomyPanelChain
} from "~/utils/resourceUi";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  amounts: Partial<Record<ResourceId, number>>;
  caps: Partial<Record<ResourceId, number | null | undefined>>;
  unlockedTechIds: readonly TechId[];
  ownedBuildingIds: readonly BuildingId[];
}>();

const chains = computed((): EconomyPanelChain[] =>
  buildEconomyPanelChains({
    amounts: props.amounts,
    caps: props.caps,
    unlockedTechIds: props.unlockedTechIds,
    ownedBuildingIds: props.ownedBuildingIds
  })
);

function close() {
  open.value = false;
}

function onBackdropKey(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

function formatAmount(value: number) {
  return Math.floor(value).toLocaleString("fr-FR");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="play-economy">
      <div
        v-if="open"
        class="play-economy"
        role="dialog"
        aria-modal="true"
        aria-labelledby="play-economy-title"
        @keydown="onBackdropKey"
      >
        <button
          type="button"
          class="play-economy__backdrop"
          aria-label="Fermer"
          @click="close"
        />

        <aside class="play-economy__panel">
          <div class="play-economy__handle" aria-hidden="true" />

          <header class="play-economy__header">
            <div>
              <p class="play-economy__eyebrow">Village</p>
              <h2 id="play-economy-title" class="play-economy__title">
                Économie
              </h2>
            </div>
            <button
              type="button"
              class="play-economy__close"
              aria-label="Fermer"
              @click="close"
            >
              <UIcon name="i-lucide-x" class="size-5" />
            </button>
          </header>

          <p class="play-economy__intro">
            Stocks de ton monde — chaînes industrielles au fil de ta progression.
          </p>

          <div class="play-economy__scroll">
            <section
              v-for="chain in chains"
              :key="chain.id"
              class="play-economy__chain"
            >
              <div class="play-economy__chain-flow" aria-hidden="true">
                <template
                  v-for="(row, index) in chain.rows"
                  :key="`${chain.id}-flow-${row.resourceId}`"
                >
                  <span
                    v-if="index > 0"
                    class="play-economy__arrow"
                  >→</span>
                  <UIcon :name="row.icon" class="play-economy__flow-icon" />
                </template>
              </div>

              <ul class="play-economy__list">
                <li
                  v-for="row in chain.rows"
                  :key="row.resourceId"
                  class="play-economy__row"
                >
                  <UIcon
                    :name="row.icon"
                    class="play-economy__row-icon"
                    aria-hidden="true"
                  />
                  <span class="play-economy__row-label">{{ row.label }}</span>
                  <span class="play-economy__row-stock">
                    <span class="play-economy__row-amount">{{
                      formatAmount(row.amount)
                    }}</span>
                    <span
                      v-if="row.cap != null"
                      class="play-economy__row-cap"
                    >/{{ formatAmount(row.cap) }}</span>
                  </span>
                </li>
              </ul>
            </section>

            <p v-if="chains.length === 0" class="play-economy__empty">
              Aucune ressource à afficher pour l’instant.
            </p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
