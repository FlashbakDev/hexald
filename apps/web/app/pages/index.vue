<script setup lang="ts">
import {
  pseudoCandidateWithSuffix,
  suggestPseudoFromIdentity,
  suggestRandomGuestPseudo,
  validatePseudo
} from "@hexald/shared";
import { getFirebaseAuthClient } from "~/utils/firebase.client";
import { fetchLeaderboard, LEADERBOARD_SCORE_LABEL } from "~/data/leaderboard";
import type { LeaderboardEntrySnapshot } from "@hexald/shared";

definePageMeta({
  layout: "default"
});

usePageSeo({
  title: "Hexald — jeu de stratégie hexagonale",
  description:
    "Pose ton village, conquiers des biomes et étends ton empire. Hexald est un jeu de gestion / stratégie persistant par navigateur, avec classement et progression de civilisation.",
  path: "/"
});

useLandingGameSchema();

const {
  pseudo,
  hasAccount,
  ready,
  probeSession,
  ensureSession,
  claimPseudo,
  checkPseudoAvailable
} = useSession();
const {
  configured: firebaseConfigured,
  firebaseUser,
  authBusy,
  authError,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail
} = useFirebaseAuth();

const sheetOpen = ref(false);
const sheetStep = ref<"menu" | "email">("menu");
const submitting = ref(false);
const formError = ref<string | null>(null);
const emailMode = ref<"login" | "register">("login");
const emailDraft = ref("");
const passwordDraft = ref("");

const hasPseudo = computed(() => !!pseudo.value);

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

const statusMessage = computed(() => {
  if (authError.value) return { tone: "error" as const, text: authError.value };
  if (formError.value) return { tone: "error" as const, text: formError.value };
  return null;
});

function extractFetchError(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("data" in err) {
    return (err as { data?: { error?: string } }).data?.error;
  }
  return undefined;
}

function openSheet() {
  formError.value = null;
  sheetStep.value = "menu";
  emailDraft.value = "";
  passwordDraft.value = "";
  emailMode.value = "login";
  sheetOpen.value = true;
}

function closeSheet() {
  sheetOpen.value = false;
  sheetStep.value = "menu";
}

function openEmailStep() {
  formError.value = null;
  sheetStep.value = "email";
}

function backToMenu() {
  formError.value = null;
  sheetStep.value = "menu";
}

async function claimUniquePseudo(
  nextCandidate: (attempt: number) => string
): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = nextCandidate(attempt);
    const validation = validatePseudo(candidate);
    if (!validation.ok) continue;
    try {
      const availability = await checkPseudoAvailable(validation.pseudo);
      if (!availability.available) continue;
      await claimPseudo(validation.pseudo);
      return true;
    } catch (err: unknown) {
      if (extractFetchError(err) === "pseudo_taken") continue;
      return false;
    }
  }
  return false;
}

async function claimCloudPseudo(): Promise<boolean> {
  const user =
    firebaseUser.value ?? getFirebaseAuthClient()?.currentUser ?? null;
  const base = suggestPseudoFromIdentity({
    displayName: user?.displayName,
    email: user?.email
  });
  return claimUniquePseudo((attempt) =>
    pseudoCandidateWithSuffix(base, attempt)
  );
}

async function claimGuestPseudo(): Promise<boolean> {
  return claimUniquePseudo(() => suggestRandomGuestPseudo());
}

async function goPlay() {
  closeSheet();
  await navigateTo("/play");
}

async function continueExisting() {
  formError.value = null;
  submitting.value = true;
  try {
    await goPlay();
  } finally {
    submitting.value = false;
  }
}

async function continueAsGuest() {
  formError.value = null;
  submitting.value = true;
  try {
    if (hasAccount.value && hasPseudo.value) {
      await goPlay();
      return;
    }
    const session = await ensureSession();
    if (!session) {
      formError.value = mapError("session_failed");
      return;
    }
    if (session.pseudo) {
      await goPlay();
      return;
    }
    const ok = await claimGuestPseudo();
    if (!ok) {
      formError.value = mapError("session_failed");
      return;
    }
    await goPlay();
  } catch {
    formError.value = mapError("session_failed");
  } finally {
    submitting.value = false;
  }
}

async function afterCloudAuth(session: { pseudo: string | null } | null) {
  if (!session) return;
  if (session.pseudo) {
    await goPlay();
    return;
  }
  submitting.value = true;
  try {
    const ok = await claimCloudPseudo();
    if (!ok) {
      formError.value = mapError("session_failed");
      return;
    }
    await goPlay();
  } finally {
    submitting.value = false;
  }
}

async function onGoogle() {
  formError.value = null;
  const session = await signInWithGoogle();
  await afterCloudAuth(session);
}

async function onEmailSubmit() {
  formError.value = null;
  const email = emailDraft.value.trim();
  const password = passwordDraft.value;
  if (!email || password.length < 6) {
    formError.value = "Email et mot de passe (6+ caractères) requis.";
    return;
  }
  const session =
    emailMode.value === "register"
      ? await registerWithEmail(email, password)
      : await signInWithEmail(email, password);
  await afterCloudAuth(session);
}

onMounted(async () => {
  if (!ready.value) await probeSession();
});

const howSection = ref<HTMLElement | null>(null);
const howVisible = ref(false);
const discoverHidden = ref(false);
let howObserver: IntersectionObserver | null = null;

function scrollToHow() {
  howSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onLandingScroll() {
  discoverHidden.value = window.scrollY > 48;
}

onMounted(() => {
  if (!import.meta.client) return;
  window.addEventListener("scroll", onLandingScroll, { passive: true });
  onLandingScroll();
  nextTick(() => {
    const el = howSection.value;
    if (!el) return;
    howObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          howVisible.value = true;
          howObserver?.disconnect();
          howObserver = null;
        }
      },
      { threshold: 0.28, rootMargin: "0px 0px -8% 0px" }
    );
    howObserver.observe(el);
  });
});

onBeforeUnmount(() => {
  howObserver?.disconnect();
  howObserver = null;
  if (import.meta.client) {
    window.removeEventListener("scroll", onLandingScroll);
  }
});

const howSteps = [
  {
    n: "01",
    icon: "i-lucide-hammer",
    title: "Pose",
    text: "Ancre ton village, construis camps et fermes sur les hex qui t’entourent."
  },
  {
    n: "02",
    icon: "i-lucide-wheat",
    title: "Produis",
    text: "Assigne ta population, remplis les stocks, fais croître ta civilisation."
  },
  {
    n: "03",
    icon: "i-lucide-orbit",
    title: "Étends",
    text: "Révèle de nouvelles régions, recherche des technologies, élargis ton monde."
  }
] as const;

const { data: leaderboardData } = await useAsyncData("landing-leaderboard", () =>
  fetchLeaderboard({ page: 1, pageSize: 3 }).catch(() => null)
);

const leaderboardPreview = computed(() => {
  const entries = leaderboardData.value?.entries ?? [];
  const byRank = Object.fromEntries(
    entries.filter((e) => e.rank <= 3).map((e) => [e.rank, e])
  ) as Record<number, LeaderboardEntrySnapshot>;
  return [byRank[2], byRank[1], byRank[3]].filter(Boolean);
});

const leaderboardScoreLabel = computed(
  () => leaderboardData.value?.scoreLabel ?? LEADERBOARD_SCORE_LABEL
);
</script>

<template>
  <div class="bg-[#dfe8e4]">
    <section class="relative isolate h-dvh overflow-hidden">
      <ClientOnly>
        <LandingWorld />
        <template #fallback>
          <div
            class="pointer-events-none absolute inset-0 bg-[#dfe8e4]"
            aria-hidden="true"
          />
        </template>
      </ClientOnly>

      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#dfe8e4]/35 lg:bg-gradient-to-r lg:from-[#dfe8e4]/70 lg:via-[#dfe8e4]/20 lg:to-transparent"
      />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#dfe8e4] from-35% via-[#dfe8e4]/90 to-transparent lg:h-52 lg:from-[#dfe8e4] lg:via-[#dfe8e4]/55"
      />
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#eef4f1]/40 to-transparent lg:h-32"
      />

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

      <div class="relative z-10 flex h-full flex-col">
        <div class="landing-col relative z-30 flex justify-end pt-[max(1rem,env(safe-area-inset-top))]">
          <SiteTopNav />
        </div>

        <div
          class="landing-col flex flex-1 flex-col justify-end pb-24 pt-10 sm:pb-28 lg:justify-end lg:pb-[22vh] lg:pt-16"
        >
          <main class="w-full max-w-xl">
            <div class="landing-rise flex items-center gap-4 sm:gap-5">
              <img
                src="/icon-128.webp"
                alt=""
                width="72"
                height="72"
                class="size-14 shrink-0 rounded-2xl object-cover shadow-[0_8px_24px_rgb(28_43_40_/_0.18)] sm:size-[4.5rem]"
                decoding="async"
                aria-hidden="true"
              />
              <h1
                class="font-display text-6xl font-medium tracking-tight text-[#1c2b28] sm:text-7xl lg:text-8xl"
              >
                Hexald
              </h1>
            </div>

            <p
              class="landing-rise landing-rise-delay-1 mt-6 max-w-md text-lg leading-relaxed text-[#3d524c] sm:text-xl"
            >
              Pose ton village, conquiers des biomes, étends ton empire.
            </p>
            <p class="sr-only">
              Hexald est un jeu de gestion et de stratégie persistant par
              navigateur : construis ton monde hexagonal, développe ta
              civilisation et compare ton score au classement.
            </p>

            <div class="landing-rise landing-rise-delay-2 relative z-20 mt-14">
              <!-- Retour : cookie / compte déjà là → direct en jeu -->
              <button
                v-if="ready && hasAccount && hasPseudo"
                type="button"
                class="landing-cta inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[#2d5248] px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] transition hover:bg-[#243f38] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:min-w-48"
                :disabled="submitting"
                @click="continueExisting"
              >
                {{ submitting ? "…" : "Continuer à jouer" }}
              </button>

              <!-- Nouveau (ou compte sans pseudo) → sheet de connexion -->
              <button
                v-else-if="ready"
                type="button"
                class="landing-cta inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[#2d5248] px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] transition hover:bg-[#243f38] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:min-w-48"
                @click="openSheet"
              >
                Commencer à jouer
              </button>

              <button
                v-else
                type="button"
                class="landing-cta inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[#2d5248] px-9 font-display text-base font-medium tracking-wide text-[#f2f7f4] opacity-55 sm:w-auto sm:min-w-48"
                disabled
              >
                …
              </button>
            </div>
          </main>
        </div>

        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-[max(1.1rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            class="landing-discover pointer-events-auto"
            :class="{ 'is-hidden': discoverHidden }"
            :tabindex="discoverHidden ? -1 : 0"
            :aria-hidden="discoverHidden"
            @click="scrollToHow"
          >
            Découvrir
            <span class="landing-discover__chevron" aria-hidden="true">
              <UIcon name="i-lucide-chevron-down" class="size-4" />
            </span>
          </button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="landing-sheet">
        <div
          v-if="sheetOpen"
          class="landing-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-sheet-title"
        >
          <button
            type="button"
            class="landing-sheet__backdrop"
            aria-label="Fermer"
            @click="closeSheet"
          />
          <div class="landing-sheet__panel">
            <div class="landing-sheet__handle" aria-hidden="true" />

            <!-- Menu principal -->
            <template v-if="sheetStep === 'menu'">
              <h2 id="landing-sheet-title" class="landing-sheet__title">
                Comment veux-tu jouer&nbsp;?
              </h2>

              <div class="landing-sheet__actions">
                <button
                  v-if="firebaseConfigured"
                  type="button"
                  class="landing-sheet__btn landing-sheet__btn--primary"
                  :disabled="authBusy || submitting"
                  @click="onGoogle"
                >
                  <UIcon name="i-lucide-chrome" class="size-4" aria-hidden="true" />
                  {{ authBusy ? "…" : "Continuer avec Google" }}
                </button>

                <button
                  v-if="firebaseConfigured"
                  type="button"
                  class="landing-sheet__btn landing-sheet__btn--secondary"
                  :disabled="authBusy || submitting"
                  @click="openEmailStep"
                >
                  <UIcon name="i-lucide-mail" class="size-4" aria-hidden="true" />
                  Continuer avec un mail
                </button>

                <button
                  type="button"
                  class="landing-sheet__guest"
                  :disabled="authBusy || submitting"
                  @click="continueAsGuest"
                >
                  {{ submitting ? "…" : "Continuer en tant qu’invité" }}
                </button>
              </div>
            </template>

            <!-- Email -->
            <template v-else-if="sheetStep === 'email'">
              <div class="landing-sheet__nav">
                <button type="button" class="landing-sheet__back" @click="backToMenu">
                  <UIcon name="i-lucide-arrow-left" class="size-4" />
                  Retour
                </button>
              </div>
              <h2 id="landing-sheet-title" class="landing-sheet__title">
                Email
              </h2>
              <div class="landing-sheet__modes">
                <button
                  type="button"
                  :class="{ 'is-active': emailMode === 'login' }"
                  @click="emailMode = 'login'"
                >
                  Connexion
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': emailMode === 'register' }"
                  @click="emailMode = 'register'"
                >
                  Créer un compte
                </button>
              </div>
              <form class="landing-sheet__email" @submit.prevent="onEmailSubmit">
                <input
                  v-model="emailDraft"
                  type="email"
                  autocomplete="email"
                  placeholder="Email"
                  :disabled="authBusy"
                >
                <input
                  v-model="passwordDraft"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Mot de passe"
                  :disabled="authBusy"
                >
                <button
                  type="submit"
                  class="landing-sheet__btn landing-sheet__btn--primary"
                  :disabled="authBusy"
                >
                  {{
                    authBusy
                      ? "…"
                      : emailMode === "register"
                        ? "Créer le compte"
                        : "Se connecter"
                  }}
                </button>
              </form>
            </template>

            <p
              v-if="statusMessage"
              class="landing-sheet__status"
              :class="{
                'is-error': statusMessage.tone === 'error',
                'is-muted': statusMessage.tone === 'muted'
              }"
            >
              {{ statusMessage.text }}
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div class="landing-after">
      <section
        id="decouvrir"
        ref="howSection"
        class="landing-how"
        :class="{ 'is-visible': howVisible }"
        aria-labelledby="landing-how-title"
      >
        <div class="landing-how__inner landing-col">
          <p class="landing-how__kicker">Le principe</p>
          <h2 id="landing-how-title" class="landing-how__title font-display">
            Trois gestes pour bâtir ton monde
          </h2>
          <p class="landing-how__lead">
            Hexald tourne autour d’une boucle simple — poser, produire, étendre —
            sur une carte hexagonale qui grandit avec toi.
          </p>

          <ol class="landing-how__steps">
            <li
              v-for="(step, i) in howSteps"
              :key="step.n"
              class="landing-how__step"
              :style="{ '--how-i': String(i) }"
            >
              <div class="landing-how__rail" aria-hidden="true">
                <span class="landing-how__num">{{ step.n }}</span>
                <span v-if="i < howSteps.length - 1" class="landing-how__line" />
              </div>
              <div class="landing-how__body">
                <div class="landing-how__icon" aria-hidden="true">
                  <UIcon :name="step.icon" class="size-6 sm:size-7" />
                </div>
                <h3 class="landing-how__step-title font-display">
                  {{ step.title }}
                </h3>
                <p class="landing-how__step-text">
                  {{ step.text }}
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section
        class="landing-about"
        aria-labelledby="landing-about-title"
      >
        <div class="landing-col">
          <p class="landing-about__kicker">Le jeu</p>
          <h2 id="landing-about-title" class="landing-about__title font-display">
            Un diorama persistant, pas une carte partagée
          </h2>
          <div class="landing-about__prose">
            <p>
              Hexald n’est pas un MMO territorial classique. Chaque joueur possède
              son propre monde hexagonal : tu poses des extracteurs, tu chaînes
              la production, tu recherches des technologies et tu choisis le
              biome de la prochaine région.
            </p>
            <p>
              La population croît avec le surplus de nourriture, les ouvriers
              font tourner les sites actifs, et les
              <strong>points de civilisation</strong> (science, production,
              population, militaire) alimentent le classement public.
            </p>
            <p>
              Nouveau&nbsp;?
              <NuxtLink to="/guide">Lis le guide</NuxtLink>
              pour les premiers pas et les biomes, suis les
              <NuxtLink to="/news">actualités</NuxtLink>,
              ou compare les empires sur le
              <NuxtLink to="/leaderboard">classement</NuxtLink>.
            </p>
          </div>
        </div>
      </section>

      <section
        class="landing-board"
        aria-labelledby="landing-board-title"
      >
        <div class="landing-col">
          <div class="landing-board__head">
            <div>
              <p class="landing-board__kicker">Classement</p>
              <h2
                id="landing-board-title"
                class="landing-board__title font-display"
              >
                Qui domine Hexald&nbsp;?
              </h2>
              <p class="landing-board__lead">
                Classement live par points de civilisation (PC) —
                Science, Production, Population, Militaire.
              </p>
            </div>
            <NuxtLink to="/leaderboard" class="landing-board__cta">
              Voir le classement
              <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
            </NuxtLink>
          </div>

          <div
            v-if="leaderboardPreview.length > 0"
            class="landing-board__podium"
            aria-label="Top 3"
          >
            <div
              v-for="entry in leaderboardPreview"
              :key="entry.rank"
              class="landing-board__slot"
              :class="`landing-board__slot--${entry.rank}`"
            >
              <span class="landing-board__rank" aria-hidden="true">{{
                entry.rank
              }}</span>
              <p class="landing-board__name font-display">{{ entry.pseudo }}</p>
              <p class="landing-board__score">
                {{ entry.score.toLocaleString("fr-FR") }}
                <span>{{ leaderboardScoreLabel }}</span>
              </p>
            </div>
          </div>
          <p v-else class="landing-board__empty mt-6 text-sm text-[#3d524c]">
            Pas encore de classement — sois le premier empire.
          </p>
        </div>
      </section>
    </div>

    <SiteFooter variant="section" />
  </div>
</template>

<style scoped>
.landing-sheet {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
}

.landing-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(28 43 40 / 0.4);
  cursor: pointer;
}

.landing-sheet__panel {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 1.5rem 1.5rem 0 0;
  background: rgb(248 251 249 / 0.97);
  box-shadow: 0 -16px 48px rgb(28 43 40 / 0.14);
  backdrop-filter: blur(12px);
}

.landing-sheet__handle {
  width: 2.5rem;
  height: 0.28rem;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: rgb(28 43 40 / 0.15);
}

.landing-sheet__title {
  margin: 0 0 1rem;
  text-align: center;
  font-family: var(--font-display, Fraunces, serif);
  font-size: 1.35rem;
  font-weight: 500;
  color: #1c2b28;
}

.landing-sheet__nav {
  margin-bottom: 0.35rem;
}

.landing-sheet__back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  color: #6b7c76;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.25rem 0;
}

.landing-sheet__back:hover {
  color: #1c2b28;
}

.landing-sheet__actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-width: 24rem;
  margin: 0 auto;
  width: 100%;
}

.landing-sheet__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 3rem;
  width: 100%;
  border: 0;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.landing-sheet__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.landing-sheet__btn--primary {
  background: #2d5248;
  color: #f2f7f4;
}

.landing-sheet__btn--primary:hover:not(:disabled) {
  background: #243f38;
}

.landing-sheet__btn--secondary {
  background: #fff;
  color: #1c2b28;
  box-shadow: inset 0 0 0 1px rgb(28 43 40 / 0.1);
}

.landing-sheet__btn--secondary:hover:not(:disabled) {
  background: #f7faf8;
}

.landing-sheet__guest {
  margin-top: 0.35rem;
  border: 0;
  background: transparent;
  color: #4a7c6f;
  font-size: 0.9rem;
  text-decoration: underline;
  text-underline-offset: 0.18em;
  cursor: pointer;
  padding: 0.5rem;
}

.landing-sheet__guest:hover:not(:disabled) {
  color: #2d5248;
}

.landing-sheet__guest:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.landing-sheet__modes {
  display: flex;
  gap: 0.35rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.landing-sheet__modes button {
  border: 0;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7c76;
  background: transparent;
  cursor: pointer;
}

.landing-sheet__modes button.is-active {
  background: #2d5248;
  color: #f2f7f4;
}

.landing-sheet__email {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 24rem;
  margin: 0 auto;
  width: 100%;
}

.landing-sheet__email input {
  height: 2.85rem;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 0 1.15rem;
  font-size: 0.95rem;
  color: #1c2b28;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgb(28 43 40 / 0.1);
  outline: none;
}

.landing-sheet__email input:focus {
  box-shadow: inset 0 0 0 2px rgb(74 124 111 / 0.35);
}

.landing-sheet__status {
  margin: 0.85rem 0 0;
  text-align: center;
  font-size: 0.85rem;
}

.landing-sheet__status.is-error {
  color: #9b4a4a;
}

.landing-sheet__status.is-muted {
  color: #6b7c76;
}

.landing-sheet-enter-active,
.landing-sheet-leave-active {
  transition: opacity 0.2s ease;
}

.landing-sheet-enter-active .landing-sheet__panel,
.landing-sheet-leave-active .landing-sheet__panel {
  transition: transform 0.26s ease;
}

.landing-sheet-enter-from,
.landing-sheet-leave-to {
  opacity: 0;
}

.landing-sheet-enter-from .landing-sheet__panel,
.landing-sheet-leave-to .landing-sheet__panel {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .landing-sheet {
    justify-content: center;
    align-items: center;
    padding: 1.25rem;
  }

  .landing-sheet__panel {
    width: min(100%, 24rem);
    padding: 1.35rem 1.35rem 1.25rem;
    border-radius: 1.5rem;
    box-shadow: 0 24px 60px rgb(28 43 40 / 0.18);
  }

  .landing-sheet__handle {
    display: none;
  }

  .landing-sheet-enter-from .landing-sheet__panel,
  .landing-sheet-leave-to .landing-sheet__panel {
    transform: translateY(0.65rem) scale(0.98);
  }
}
</style>
