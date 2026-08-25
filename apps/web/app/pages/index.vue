<script setup lang="ts">
import {
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
  validatePseudo
} from "@hexald/shared";

definePageMeta({
  layout: "default"
});

useHead({
  title: "Hexald"
});

const router = useRouter();
const { pseudo, ready, ensureSession, claimPseudo } = useSession();

const draft = ref("");
const submitting = ref(false);
const formError = ref<string | null>(null);

const hasPseudo = computed(() => !!pseudo.value);

watch(
  pseudo,
  (value) => {
    if (value && !draft.value) draft.value = value;
  },
  { immediate: true }
);

const errorMessages: Record<string, string> = {
  empty: "Choisis un pseudo.",
  too_short: `Au moins ${PSEUDO_MIN_LENGTH} caractères.`,
  too_long: `Au plus ${PSEUDO_MAX_LENGTH} caractères.`,
  invalid_chars: "Lettres, chiffres et _ uniquement.",
  pseudo_taken: "Ce pseudo est déjà pris.",
  pseudo_locked: "Ton pseudo est déjà fixé.",
  session_failed: "Impossible de rejoindre le serveur."
};

function mapError(code: string | undefined) {
  if (!code) return "Une erreur est survenue.";
  return errorMessages[code] ?? "Une erreur est survenue.";
}

async function play() {
  formError.value = null;
  submitting.value = true;

  try {
    await ensureSession();

    if (!pseudo.value) {
      const validation = validatePseudo(draft.value);
      if (!validation.ok) {
        formError.value = mapError(validation.reason);
        return;
      }

      try {
        await claimPseudo(validation.pseudo);
      } catch (err: unknown) {
        const data =
          err && typeof err === "object" && "data" in err
            ? (err as { data?: { error?: string } }).data
            : undefined;
        formError.value = mapError(data?.error);
        return;
      }
    }

    await router.push("/play");
  } catch {
    formError.value = mapError("session_failed");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="relative isolate min-h-dvh overflow-hidden bg-[#041c22]">
    <LandingWorld />

    <!-- Lisible à gauche, monde coloré bien visible à droite -->
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#041c22] via-[#041c22]/75 to-transparent lg:via-[#041c22]/55 lg:to-transparent"
    />
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#041c22]/90 to-transparent"
    />

    <div class="relative z-10 flex min-h-dvh flex-col justify-end lg:justify-center">
      <main class="w-full max-w-2xl px-5 pb-10 pt-24 sm:px-8 sm:pb-14 lg:px-12 lg:pb-16">
        <p
          class="landing-rise font-display text-sm font-bold tracking-[0.35em] text-[#34d399] uppercase sm:text-base"
        >
          Monde persistant
        </p>

        <h1
          class="landing-rise landing-rise-delay-1 font-display mt-3 text-6xl leading-[0.9] font-extrabold tracking-tight text-[#f4fff8] drop-shadow-[0_8px_32px_rgb(0_0_0_/_0.45)] sm:text-7xl lg:text-8xl"
        >
          Hexald
        </h1>

        <p
          class="landing-rise landing-rise-delay-2 mt-5 max-w-lg text-lg text-[#b8f3e0] sm:text-xl"
        >
          Colonise des hexagones, étends tes biomes, bâtis ton empire — une région à la fois.
        </p>

        <form
          class="landing-rise landing-rise-delay-3 mt-10 flex w-full max-w-xl flex-col gap-4"
          @submit.prevent="play"
        >
          <label class="sr-only" for="pseudo">Pseudo</label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              id="pseudo"
              v-model="draft"
              type="text"
              name="pseudo"
              autocomplete="username"
              :maxlength="PSEUDO_MAX_LENGTH"
              :disabled="hasPseudo || submitting || !ready"
              :readonly="hasPseudo"
              placeholder="Choisis ton pseudo"
              class="h-16 min-w-0 flex-1 border-2 border-[#34d399]/45 bg-[#062f36]/85 px-5 text-xl text-[#f4fff8] shadow-[0_0_0_1px_rgb(14_165_198_/_0.25)_inset] outline-none backdrop-blur-md transition placeholder:text-[#7cb8b0] focus:border-[#fbbf24] focus:shadow-[0_0_0_4px_rgb(251_191_36_/_0.25)] disabled:opacity-80 sm:h-[4.25rem] sm:text-2xl"
            >
            <button
              type="submit"
              class="landing-cta-glow h-16 shrink-0 bg-[#fbbf24] px-10 font-display text-lg font-extrabold tracking-wide text-[#041c22] uppercase transition hover:scale-[1.03] hover:bg-[#fcd34d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-[4.25rem] sm:min-w-44 sm:text-xl"
              :disabled="submitting || !ready"
            >
              {{ submitting ? "…" : hasPseudo ? "Continuer" : "Jouer" }}
            </button>
          </div>

          <p v-if="formError" class="text-base font-medium text-[#fb7185]">
            {{ formError }}
          </p>
          <p v-else-if="hasPseudo" class="text-base text-[#7ee0c8]">
            Prêt · {{ pseudo }}
          </p>
          <p v-else class="text-base text-[#7cb8b0]">
            3–20 caractères · lettres, chiffres, _
          </p>
        </form>
      </main>
    </div>
  </div>
</template>
