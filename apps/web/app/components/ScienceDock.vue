<script setup lang="ts">
import { getTechNode } from "@hexald/content";
import type { WorldResearchSnapshot } from "@hexald/shared";

const props = withDefaults(
  defineProps<{
    research?: WorldResearchSnapshot | null;
    active?: boolean;
  }>(),
  {
    research: null,
    active: false
  }
);

const emit = defineEmits<{
  click: [];
}>();

const researching = computed(() => {
  const id = props.research?.researchTargetTechId;
  if (!id) return null;
  return getTechNode(id);
});

const progressPercent = computed(() => {
  const id = props.research?.researchTargetTechId;
  if (!id) return 0;
  const entry = props.research?.techProgress.find((row) => row.techId === id);
  if (!entry || entry.scienceCost <= 0) return 0;
  return Math.min(100, Math.round((entry.progress / entry.scienceCost) * 100));
});
</script>

<template>
  <button
    type="button"
    class="play-science-dock"
    :class="{
      'play-science-dock--active': active,
      'play-science-dock--empty': !researching,
      'play-science-dock--researching': researching
    }"
    :title="
      researching
        ? `Recherche : ${researching.label}`
        : 'Technologies — choisis une recherche'
    "
    :aria-label="
      researching
        ? `Recherche en cours : ${researching.label}`
        : 'Technologies — aucune recherche en cours'
    "
    @click="emit('click')"
  >
    <template v-if="researching">
      <UIcon :name="researching.icon" class="play-science-dock__icon" aria-hidden="true" />
      <span class="play-science-dock__label">{{ researching.label }}</span>
      <div
        class="play-science-dock__progress"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progression : ${researching.label}`"
      >
        <div
          class="play-science-dock__progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </template>
    <template v-else>
      <UIcon
        name="i-lucide-flask-conical"
        class="play-science-dock__icon play-science-dock__icon--empty"
        aria-hidden="true"
      />
      <span class="play-science-dock__empty" aria-hidden="true">—</span>
    </template>
  </button>
</template>
