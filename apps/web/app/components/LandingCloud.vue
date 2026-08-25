<script setup lang="ts">
/** Nuage SVG organique — variantes de forme via `variant`. */
const props = withDefaults(
  defineProps<{
    variant?: 1 | 2 | 3;
  }>(),
  { variant: 1 }
);

const uid = useId().replace(/:/g, "");
const fillId = `cloud-fill-${uid}`;
const softId = `cloud-soft-${uid}`;

const paths: Record<1 | 2 | 3, string> = {
  1: "M28 72c-14 0-24-9-24-20 0-12 9-21 22-22 3-14 15-24 30-24 12 0 23 6 28 16 5-3 11-5 18-5 18 0 32 13 32 30 0 2 0 4-.4 6C142 56 152 66 152 78c0 14-12 24-28 24H40c-7 0-12-2-12-6z",
  2: "M22 78c-11 0-20-8-20-18S12 43 24 41c2-12 13-21 26-21 9 0 17 4 22 11 4-5 11-8 18-8 14 0 26 10 28 23 6-4 13-6 21-6 16 0 29 12 29 28 0 15-13 27-29 27H40c-10 0-18-8-18-17z",
  3: "M34 70c-12 1-22-7-22-17 0-11 8-19 19-20 4-13 16-22 30-22 11 0 20 5 25 13 6-4 13-6 20-6 17 0 31 12 32 28 7-2 14-1 20 3 10 7 12 20 5 29-5 7-14 10-23 10H48c-8 0-14-4-14-10z"
};
</script>

<template>
  <svg
    class="landing-cloud__svg"
    viewBox="0 0 160 110"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient :id="fillId" x1="20%" y1="5%" x2="55%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
        <stop offset="40%" stop-color="#f7faf8" stop-opacity="0.88" />
        <stop offset="78%" stop-color="#e8f0ec" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#dfe8e4" stop-opacity="0.15" />
      </linearGradient>
      <filter :id="softId" x="-25%" y="-35%" width="150%" height="170%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" />
      </filter>
    </defs>
    <path
      :d="paths[props.variant]"
      :fill="`url(#${fillId})`"
      :filter="`url(#${softId})`"
    />
  </svg>
</template>
