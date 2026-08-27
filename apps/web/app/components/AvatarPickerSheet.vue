<script setup lang="ts">
import {
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
  validatePseudo,
  type ProfileAvatarId
} from "@hexald/shared";
import {
  PROFILE_AVATAR_OPTIONS,
  type ProfileAvatarOption
} from "~/utils/profileAvatars";

const open = defineModel<boolean>("open", { default: false });

const props = withDefaults(
  defineProps<{
    selectedId?: string | null;
    currentPseudo?: string | null;
    saving?: boolean;
    renaming?: boolean;
    renameError?: string | null;
  }>(),
  {
    selectedId: null,
    currentPseudo: null,
    saving: false,
    renaming: false,
    renameError: null
  }
);

const emit = defineEmits<{
  select: [avatarId: ProfileAvatarId];
  rename: [pseudo: string];
}>();

const options = PROFILE_AVATAR_OPTIONS;
const draftPseudo = ref("");

watch(
  () => [open.value, props.currentPseudo] as const,
  ([isOpen]) => {
    if (isOpen) {
      draftPseudo.value = props.currentPseudo ?? "";
    }
  }
);

const busy = computed(() => props.saving || props.renaming);

const canSubmitRename = computed(() => {
  const next = draftPseudo.value.trim();
  if (!next || busy.value) return false;
  if (next === (props.currentPseudo ?? "")) return false;
  return validatePseudo(next).ok;
});

const localHint = computed(() => {
  const next = draftPseudo.value.trim();
  if (!next) return "3–20 caractères : lettres, chiffres, _";
  const validation = validatePseudo(next);
  if (!validation.ok) {
    if (validation.reason === "too_short") return "Trop court (min. 3).";
    if (validation.reason === "too_long") return "Trop long (max. 20).";
    if (validation.reason === "invalid_chars") {
      return "Lettres, chiffres et _ uniquement.";
    }
    return "Nom invalide.";
  }
  if (next === (props.currentPseudo ?? "")) return "C’est déjà ton nom.";
  return null;
});

function close() {
  open.value = false;
}

function onPick(option: ProfileAvatarOption) {
  if (busy.value) return;
  if (option.id === props.selectedId) return;
  emit("select", option.id);
}

function onSubmitRename() {
  if (!canSubmitRename.value) return;
  emit("rename", draftPseudo.value.trim());
}
</script>

<template>
  <Transition name="building-sheet">
    <aside
      v-if="open"
      class="building-sheet avatar-picker-sheet pointer-events-none absolute inset-x-0 bottom-0 z-50"
      role="dialog"
      aria-label="Profil"
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
              id="play-cloud-avatar-fill"
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
              id="play-cloud-avatar-soft"
              x="-6%"
              y="-35%"
              width="112%"
              height="180%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
            </filter>
          </defs>
          <path
            fill="url(#play-cloud-avatar-fill)"
            filter="url(#play-cloud-avatar-soft)"
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
      </div>

      <div class="building-sheet__content avatar-picker-sheet__content pointer-events-auto">
        <div class="avatar-picker-sheet__head">
          <div class="min-w-0">
            <p class="building-sheet__title">Profil</p>
            <p class="building-sheet__hint">Pseudo et avatar.</p>
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

        <form class="avatar-picker-sheet__rename" @submit.prevent="onSubmitRename">
          <label class="avatar-picker-sheet__rename-label" for="play-rename-pseudo">
            Pseudo
          </label>
          <div class="avatar-picker-sheet__rename-row">
            <input
              id="play-rename-pseudo"
              v-model="draftPseudo"
              class="avatar-picker-sheet__rename-input"
              type="text"
              autocomplete="username"
              spellcheck="false"
              :maxlength="PSEUDO_MAX_LENGTH"
              :minlength="PSEUDO_MIN_LENGTH"
              :disabled="busy"
              placeholder="Ton nom"
            />
            <button
              type="submit"
              class="avatar-picker-sheet__rename-btn"
              :disabled="!canSubmitRename"
            >
              {{ renaming ? "…" : "OK" }}
            </button>
          </div>
          <p
            v-if="renameError || localHint"
            class="avatar-picker-sheet__rename-hint"
            :class="{ 'avatar-picker-sheet__rename-hint--error': !!renameError }"
          >
            {{ renameError || localHint }}
          </p>
        </form>

        <p class="avatar-picker-sheet__section-label">Avatar</p>
        <div class="avatar-picker-sheet__grid" role="listbox" aria-label="Avatars">
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            role="option"
            class="avatar-picker-sheet__item"
            :class="{
              'avatar-picker-sheet__item--selected': option.id === selectedId
            }"
            :aria-selected="option.id === selectedId"
            :disabled="busy"
            :title="option.label"
            @click="onPick(option)"
          >
            <span
              class="avatar-picker-sheet__portrait"
              :style="{ backgroundImage: `url(${option.src})` }"
            />
            <span class="avatar-picker-sheet__label">{{ option.label }}</span>
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>
