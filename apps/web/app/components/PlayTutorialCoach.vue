<script setup lang="ts">
import type { PlayTutorialStep, TutorialHole } from "~/composables/usePlayTutorial";

const props = defineProps<{
  step: PlayTutorialStep;
  stepIndex: number;
  stepCount: number;
  /** Spotlight UI (header / boutons). Null sur les étapes carte. */
  hole: TutorialHole | null;
  /** true = bloquer hors spotlight ; false = caméra / carte libres. */
  lockMap: boolean;
  stageWidth: number;
  stageHeight: number;
}>();

const emit = defineEmits<{
  next: [];
  skip: [];
  finish: [];
}>();

const hasSpotlight = computed(() => Boolean(props.hole));

const cardStyle = computed(() => {
  const hole = props.hole;
  const pad = 16;
  const cardW = Math.min(300, Math.max(220, props.stageWidth - pad * 2));
  let left = props.stageWidth / 2 - cardW / 2;
  let top = props.stageHeight * 0.62;

  if (hole) {
    const holeBottom = hole.y + hole.h;
    const holeCenterX = hole.x + hole.w / 2;
    left = Math.min(
      Math.max(pad, holeCenterX - cardW / 2),
      props.stageWidth - cardW - pad
    );
    if (holeBottom + 140 < props.stageHeight - pad) {
      top = holeBottom + 14;
    } else {
      top = Math.max(pad, hole.y - 128);
    }
  } else if (!props.lockMap) {
    top = Math.max(pad, props.stageHeight - 148);
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${cardW}px`
  };
});

const spotlightStyle = computed(() => {
  const hole = props.hole;
  if (!hole) return null;
  return {
    left: `${hole.x}px`,
    top: `${hole.y}px`,
    width: `${hole.w}px`,
    height: `${hole.h}px`,
    borderRadius: `${hole.radius ?? 16}px`
  };
});

/** Blockers uniquement quand un spotlight UI est actif. */
const blockStyles = computed(() => {
  if (!props.lockMap || !props.hole) return [];

  const W = Math.max(0, props.stageWidth);
  const H = Math.max(0, props.stageHeight);
  const hole = props.hole;
  const hit = hole.hit ?? hole;
  const x = Math.max(0, hit.x);
  const y = Math.max(0, hit.y);
  const w = Math.max(0, hit.w);
  const h = Math.max(0, hit.h);
  const right = Math.max(0, W - x - w);
  const bottom = Math.max(0, H - y - h);

  return [
    { left: "0px", top: "0px", width: `${W}px`, height: `${y}px` },
    { left: "0px", top: `${y + h}px`, width: `${W}px`, height: `${bottom}px` },
    { left: "0px", top: `${y}px`, width: `${x}px`, height: `${h}px` },
    { left: `${x + w}px`, top: `${y}px`, width: `${right}px`, height: `${h}px` }
  ].filter((box) => Number.parseFloat(box.width) > 0 && Number.parseFloat(box.height) > 0);
});
</script>

<template>
  <div
    class="play-tutorial"
    :class="{ 'play-tutorial--map-free': !lockMap }"
    role="dialog"
    aria-modal="false"
    :aria-label="step.title"
  >
    <div
      v-if="hasSpotlight && spotlightStyle"
      class="play-tutorial__hole"
      :style="spotlightStyle"
      aria-hidden="true"
    />

    <div
      v-for="(box, index) in blockStyles"
      :key="`b-${index}`"
      class="play-tutorial__block"
      :style="box"
      aria-hidden="true"
    />

    <div class="play-tutorial__card" :style="cardStyle">
      <div class="play-tutorial__meta">
        <span>{{ stepIndex + 1 }}/{{ stepCount }}</span>
        <button type="button" class="play-tutorial__skip" @click="emit('skip')">
          Passer
        </button>
      </div>
      <p class="play-tutorial__title">{{ step.title }}</p>
      <p class="play-tutorial__body">{{ step.body }}</p>
      <div class="play-tutorial__actions">
        <button
          v-if="step.mode === 'next'"
          type="button"
          class="play-tutorial__cta"
          @click="emit('next')"
        >
          Suivant
        </button>
        <button
          v-else-if="step.mode === 'finish'"
          type="button"
          class="play-tutorial__cta"
          @click="emit('finish')"
        >
          Jouer
        </button>
        <p v-else class="play-tutorial__action-hint">
          Fais l’action sur la carte
        </p>
      </div>
    </div>
  </div>
</template>
