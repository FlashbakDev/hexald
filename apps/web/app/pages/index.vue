<script setup lang="ts">
import { PSEUDO_MAX_LENGTH, validatePseudo } from "@hexald/shared";

definePageMeta({
  layout: "default"
});

useHead({
  title: "Hexald"
});

const { pseudo, ready, ensureSession, claimPseudo, checkPseudoAvailable } =
  useSession();

const draft = ref("");
const submitting = ref(false);
const formError = ref<string | null>(null);
const availabilityError = ref<string | null>(null);
const checkingAvailability = ref(false);

const hasPseudo = computed(() => !!pseudo.value);

watch(
  pseudo,
  (value) => {
    if (value && !draft.value) draft.value = value;
  },
  { immediate: true }
);

const errorMessages: Record<string, string> = {
  empty: "Choisis un nom.",
  too_short: "Nom invalide.",
  too_long: "Nom invalide.",
  invalid_chars: "Nom invalide.",
  pseudo_taken: "Ce nom est déjà pris.",
  pseudo_locked: "Ton nom est déjà fixé.",
  session_failed: "Impossible de rejoindre le serveur."
};

function mapError(code: string | undefined) {
  if (!code) return "Une erreur est survenue.";
  return errorMessages[code] ?? "Une erreur est survenue.";
}

const canSubmit = computed(() => {
  if (!ready.value || submitting.value) return false;
  if (hasPseudo.value) return true;
  if (checkingAvailability.value) return false;
  if (availabilityError.value) return false;
  return draft.value.trim().length > 0;
});

const statusMessage = computed(() => {
  if (formError.value) return { tone: "error" as const, text: formError.value };
  if (hasPseudo.value) return null;
  if (availabilityError.value) {
    return { tone: "error" as const, text: availabilityError.value };
  }
  if (checkingAvailability.value) {
    return { tone: "muted" as const, text: "Vérification…" };
  }
  return null;
});

let availabilityTimer: ReturnType<typeof setTimeout> | null = null;
let availabilityRequest = 0;

async function verifyAvailability(value: string) {
  const requestId = ++availabilityRequest;
  availabilityError.value = null;

  const validation = validatePseudo(value);
  if (!validation.ok) {
    checkingAvailability.value = false;
    return;
  }

  checkingAvailability.value = true;
  try {
    await ensureSession();
    const result = await checkPseudoAvailable(validation.pseudo);
    if (requestId !== availabilityRequest) return;

    if (!result.available) {
      availabilityError.value = mapError(result.reason ?? "pseudo_taken");
    }
  } catch {
    if (requestId !== availabilityRequest) return;
    availabilityError.value = mapError("session_failed");
  } finally {
    if (requestId === availabilityRequest) {
      checkingAvailability.value = false;
    }
  }
}

watch(draft, (value) => {
  formError.value = null;
  if (hasPseudo.value) return;

  if (availabilityTimer) clearTimeout(availabilityTimer);
  availabilityError.value = null;

  if (!value.trim()) {
    checkingAvailability.value = false;
    availabilityRequest += 1;
    return;
  }

  checkingAvailability.value = true;
  availabilityTimer = setTimeout(() => {
    void verifyAvailability(value);
  }, 400);
});

onBeforeUnmount(() => {
  if (availabilityTimer) clearTimeout(availabilityTimer);
});

function extractFetchError(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    return data?.error;
  }
  return undefined;
}

async function play() {
  formError.value = null;
  submitting.value = true;

  try {
    const session = await ensureSession();
    if (!session) {
      formError.value = mapError("session_failed");
      return;
    }

    if (!session.pseudo) {
      const validation = validatePseudo(draft.value);
      if (!validation.ok) {
        formError.value = mapError(validation.reason);
        return;
      }

      const availability = await checkPseudoAvailable(validation.pseudo);
      if (!availability.available) {
        formError.value = mapError(availability.reason ?? "pseudo_taken");
        availabilityError.value = formError.value;
        return;
      }

      try {
        await claimPseudo(validation.pseudo);
      } catch (err: unknown) {
        formError.value = mapError(extractFetchError(err));
        if (extractFetchError(err) === "pseudo_taken") {
          availabilityError.value = formError.value;
        }
        return;
      }
    }

    await navigateTo("/play");
  } catch {
    formError.value = mapError("session_failed");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="bg-[#dfe8e4]">
    <section class="relative isolate h-dvh overflow-hidden">
      <LandingWorld />

      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#e8f0ec]/30 lg:bg-gradient-to-r lg:from-[#e8f0ec]/75 lg:via-[#e8f0ec]/25 lg:to-transparent"
      />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#dfe8e4] from-40% via-[#dfe8e4]/85 to-transparent lg:h-44 lg:from-[#dfe8e4]/65 lg:via-transparent"
      />
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#eef4f1]/40 to-transparent lg:h-32"
      />

      <!-- Transition carte → titre : bande diagonale de nuages -->
      <div
        class="landing-clouds pointer-events-none absolute inset-0 z-[5] overflow-hidden"
        aria-hidden="true"
      >
        <div class="landing-clouds__veil" />
        <div class="landing-cloud landing-cloud--1"><LandingCloud :variant="1" /></div>
        <div class="landing-cloud landing-cloud--2"><LandingCloud :variant="2" /></div>
        <div class="landing-cloud landing-cloud--3"><LandingCloud :variant="3" /></div>
        <div class="landing-cloud landing-cloud--4"><LandingCloud :variant="1" /></div>
        <div class="landing-cloud landing-cloud--5"><LandingCloud :variant="2" /></div>
        <div class="landing-cloud landing-cloud--6"><LandingCloud :variant="3" /></div>
        <div class="landing-cloud landing-cloud--7"><LandingCloud :variant="1" /></div>
        <div class="landing-cloud landing-cloud--8"><LandingCloud :variant="2" /></div>
      </div>

      <div class="relative z-10 flex h-full flex-col justify-end lg:justify-center">
        <main class="w-full max-w-xl px-6 pb-14 pt-28 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
          <h1
            class="landing-rise font-display text-6xl font-medium tracking-tight text-[#1c2b28] sm:text-7xl lg:text-8xl"
          >
            Hexald
          </h1>

          <p
            class="landing-rise landing-rise-delay-1 mt-6 max-w-md text-lg leading-relaxed text-[#3d524c] sm:text-xl"
          >
            Pose ton village, conquiers des biomes, étends ton empire.
          </p>

          <form
            class="landing-rise landing-rise-delay-2 relative z-20 mt-14 flex w-full max-w-md flex-col gap-3"
            @submit.prevent="play"
          >
            <template v-if="!ready">
              <button
                type="button"
                class="landing-cta h-14 w-full rounded-full bg-[#2d5248]/70 px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] sm:w-auto sm:min-w-36"
                disabled
              >
                …
              </button>
            </template>

            <template v-else-if="hasPseudo">
              <NuxtLink
                to="/play"
                class="landing-cta inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[#2d5248] px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] no-underline transition hover:bg-[#243f38] active:scale-[0.99] sm:w-auto sm:min-w-36"
              >
                Continuer
              </NuxtLink>
            </template>

            <template v-else>
              <label class="sr-only" for="pseudo">Nom de compte</label>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <div class="relative min-w-0 flex-1">
                  <input
                    id="pseudo"
                    v-model="draft"
                    type="text"
                    name="pseudo"
                    autocomplete="username"
                    :maxlength="PSEUDO_MAX_LENGTH"
                    :disabled="submitting"
                    placeholder="Nom de compte"
                    class="h-14 w-full rounded-full border-0 bg-white/70 px-6 text-lg text-[#1c2b28] shadow-[0_8px_30px_rgb(28_43_40_/_0.06)] outline-none ring-1 ring-[#1c2b28]/08 backdrop-blur-md transition placeholder:text-[#8a9a94] focus:bg-white/90 focus:ring-2 focus:ring-[#4a7c6f]/35 disabled:opacity-80"
                    :aria-invalid="!!(formError || availabilityError)"
                    :aria-describedby="statusMessage ? 'pseudo-status' : undefined"
                  >
                </div>
                <button
                  type="submit"
                  class="landing-cta h-14 shrink-0 cursor-pointer rounded-full bg-[#2d5248] px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] transition hover:bg-[#243f38] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-36"
                  :disabled="!canSubmit"
                >
                  {{ submitting ? "…" : "Jouer" }}
                </button>
              </div>

              <p
                v-if="statusMessage"
                id="pseudo-status"
                class="min-h-5 px-1 text-sm"
                :class="{
                  'text-[#9b4a4a]': statusMessage.tone === 'error',
                  'text-[#6b7c76]': statusMessage.tone === 'muted'
                }"
              >
                {{ statusMessage.text }}
              </p>
            </template>
          </form>
        </main>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>
