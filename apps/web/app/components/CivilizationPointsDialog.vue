<script setup lang="ts">
import type { CivilizationPointsSnapshot } from "@hexald/shared";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  points: CivilizationPointsSnapshot | null;
}>();

const rows = computed(() => {
  const p = props.points;
  return [
    {
      id: "science",
      label: "Science",
      desc: "Technologies débloquées (coût science)",
      icon: "i-lucide-flask-conical",
      value: p?.science ?? 0
    },
    {
      id: "production",
      label: "Production",
      desc: "Bâtiments actifs avec au moins un ouvrier",
      icon: "i-lucide-hammer",
      value: p?.production ?? 0
    },
    {
      id: "population",
      label: "Population",
      desc: "Habitants × 10",
      icon: "i-lucide-users",
      value: p?.population ?? 0
    },
    {
      id: "military",
      label: "Militaire",
      desc: "Caserne et unités (bientôt)",
      icon: "i-lucide-shield",
      value: p?.military ?? 0
    }
  ] as const;
});

const total = computed(() => props.points?.total ?? 0);

function close() {
  open.value = false;
}

function formatPc(value: number) {
  return value.toLocaleString("fr-FR");
}
</script>

<template>
  <Transition name="building-sheet">
    <aside
      v-if="open"
      class="building-sheet civ-points-sheet pointer-events-none absolute inset-x-0 bottom-0 z-50"
      role="dialog"
      aria-label="Points de civilisation"
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
              id="play-cloud-civ-fill"
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
              id="play-cloud-civ-soft"
              x="-6%"
              y="-35%"
              width="112%"
              height="180%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
            </filter>
          </defs>
          <path
            fill="url(#play-cloud-civ-fill)"
            filter="url(#play-cloud-civ-soft)"
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

      <div class="building-sheet__content civ-points-sheet__content pointer-events-auto">
        <div class="civ-points-sheet__head">
          <div class="min-w-0">
            <p id="civ-points-title" class="building-sheet__title">
              Points de civilisation
            </p>
            <p class="building-sheet__hint">
              Représente l’avancée de votre civilisation au global.
            </p>
          </div>
          <button
            type="button"
            class="building-sheet__close"
            aria-label="Fermer"
            @click="close"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>

        <ul class="play-civ-points__list" aria-labelledby="civ-points-title">
          <li
            v-for="row in rows"
            :key="row.id"
            class="play-civ-points__row"
          >
            <UIcon
              :name="row.icon"
              class="play-civ-points__row-icon"
              aria-hidden="true"
            />
            <div class="play-civ-points__row-text">
              <span class="play-civ-points__row-label">{{ row.label }}</span>
              <span class="play-civ-points__row-desc">{{ row.desc }}</span>
            </div>
            <span class="play-civ-points__row-value">{{ formatPc(row.value) }}</span>
          </li>
        </ul>

        <p class="play-civ-points__total">
          <span>Total</span>
          <strong>{{ formatPc(total) }} PC</strong>
        </p>
      </div>
    </aside>
  </Transition>
</template>
