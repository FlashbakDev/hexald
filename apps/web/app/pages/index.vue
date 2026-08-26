<script setup lang="ts">
import {
  pseudoCandidateWithSuffix,
  suggestPseudoFromIdentity,
  suggestRandomGuestPseudo,
  validatePseudo
} from "@hexald/shared";
import { getFirebaseAuthClient } from "~/utils/firebase.client";

definePageMeta({
  layout: "default"
});

useHead({
  title: "Hexald"
});

const {
  pseudo,
  kind,
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
  if (kind.value === "firebase" && !hasPseudo.value) {
    submitting.value = true;
    try {
      const ok = await claimCloudPseudo();
      if (ok) await goPlay();
      else formError.value = mapError("session_failed");
    } finally {
      submitting.value = false;
    }
  }
});
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
          <div class="landing-rise flex items-center gap-4 sm:gap-5">
            <img
              src="/icon.png"
              alt=""
              width="72"
              height="72"
              class="size-14 shrink-0 rounded-2xl object-cover shadow-[0_8px_24px_rgb(28_43_40_/_0.18)] sm:size-[4.5rem]"
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

    <SiteFooter />
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
