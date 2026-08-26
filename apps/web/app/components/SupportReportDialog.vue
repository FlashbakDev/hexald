<script setup lang="ts">
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  type SupportCategory,
  type SupportReportResult
} from "@hexald/shared";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  worldId?: string | null;
}>();

const config = useRuntimeConfig();

const category = ref<SupportCategory>("bug");
const message = ref("");
const sending = ref(false);
const error = ref<string | null>(null);
const sent = ref(false);

const categories: { id: SupportCategory; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "suggestion", label: "Suggestion d’amélioration" },
  { id: "support", label: "Demande de support" }
];

const canSubmit = computed(() => {
  const len = message.value.trim().length;
  return (
    !sending.value &&
    len >= SUPPORT_MESSAGE_MIN &&
    len <= SUPPORT_MESSAGE_MAX
  );
});

watch(open, (isOpen) => {
  if (!isOpen) return;
  error.value = null;
  sent.value = false;
  sending.value = false;
});

function close() {
  if (sending.value) return;
  open.value = false;
}

function resetForm() {
  category.value = "bug";
  message.value = "";
  error.value = null;
  sent.value = false;
}

async function submit() {
  if (!canSubmit.value) return;
  sending.value = true;
  error.value = null;
  try {
    await $fetch<SupportReportResult>("/v1/support", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include",
      body: {
        category: category.value,
        message: message.value.trim(),
        meta: {
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          worldId: props.worldId ?? undefined
        }
      }
    });
    sent.value = true;
    message.value = "";
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;
    if (status === 429) {
      error.value = "Attends un peu avant de renvoyer un message.";
    } else if (status === 503) {
      error.value = "Envoi indisponible pour le moment. Réessaie plus tard.";
    } else {
      error.value = "Impossible d’envoyer le message. Réessaie.";
    }
  } finally {
    sending.value = false;
  }
}

function onSentClose() {
  resetForm();
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="play-support-sheet">
      <div
        v-if="open"
        class="play-support-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-sheet-title"
      >
        <button
          type="button"
          class="play-support-sheet__backdrop"
          aria-label="Fermer"
          :disabled="sending"
          @click="close"
        />
        <div class="play-support-sheet__panel">
          <div class="play-support-sheet__handle" aria-hidden="true" />

          <template v-if="sent">
            <div class="play-support-sheet__icon play-support-sheet__icon--ok" aria-hidden="true">
              <UIcon name="i-lucide-check" class="size-7" />
            </div>
            <h2 id="support-sheet-title" class="play-support-sheet__title">
              Message envoyé
            </h2>
            <p class="play-support-sheet__body">
              Merci — on lit chaque retour. Tu peux continuer à jouer.
            </p>
            <div class="play-support-sheet__actions">
              <button
                type="button"
                class="play-support-sheet__btn play-support-sheet__btn--primary"
                @click="onSentClose"
              >
                Fermer
              </button>
            </div>
          </template>

          <template v-else>
            <h2 id="support-sheet-title" class="play-support-sheet__title">
              Nous écrire
            </h2>
            <p class="play-support-sheet__body">
              Bug, idée ou besoin d’aide — ton message part à contact@hexald.com.
            </p>

            <label class="play-support-sheet__field">
              <span class="play-support-sheet__label">Type</span>
              <select v-model="category" class="play-support-sheet__select" :disabled="sending">
                <option v-for="opt in categories" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </label>

            <label class="play-support-sheet__field">
              <span class="play-support-sheet__label">Message</span>
              <textarea
                v-model="message"
                class="play-support-sheet__textarea"
                rows="5"
                :maxlength="SUPPORT_MESSAGE_MAX"
                :disabled="sending"
                placeholder="Décris le problème ou ta suggestion…"
              />
              <span class="play-support-sheet__hint">
                {{ message.trim().length }}/{{ SUPPORT_MESSAGE_MAX }}
                · min. {{ SUPPORT_MESSAGE_MIN }} caractères
              </span>
            </label>

            <p v-if="error" class="play-support-sheet__error">
              {{ error }}
            </p>

            <div class="play-support-sheet__actions">
              <button
                type="button"
                class="play-support-sheet__btn play-support-sheet__btn--primary"
                :disabled="!canSubmit"
                @click="submit"
              >
                {{ sending ? "Envoi…" : "Envoyer" }}
              </button>
              <button
                type="button"
                class="play-support-sheet__btn play-support-sheet__btn--ghost"
                :disabled="sending"
                @click="close"
              >
                Annuler
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
