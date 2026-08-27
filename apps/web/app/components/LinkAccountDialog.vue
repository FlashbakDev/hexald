<script setup lang="ts">
import { getFirebaseConfigDebug } from "~/utils/firebase.client";

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  linked: [];
  dismiss: [];
}>();

const {
  configured,
  authBusy,
  authError,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail
} = useFirebaseAuth();

const emailPanelOpen = ref(false);
const emailMode = ref<"login" | "register">("login");
const emailDraft = ref("");
const passwordDraft = ref("");

const firebaseDebug = computed(() => getFirebaseConfigDebug());

watch(open, (isOpen) => {
  if (!import.meta.client || !isOpen) return;
  console.info("[hexald:link-account] dialog mounted/open", {
    configured: configured.value,
    firebase: firebaseDebug.value,
    authError: authError.value
  });
});

async function onGoogle() {
  console.info("[hexald:link-account] Google click", {
    configured: configured.value,
    firebase: firebaseDebug.value
  });
  if (!configured.value) return;
  const session = await signInWithGoogle();
  console.info("[hexald:link-account] Google result", {
    ok: Boolean(session),
    kind: session?.kind ?? null,
    authError: authError.value
  });
  if (session && session.kind === "firebase") {
    open.value = false;
    emit("linked");
  }
}

async function onEmailSubmit() {
  const email = emailDraft.value.trim();
  const password = passwordDraft.value;
  console.info("[hexald:link-account] email submit", {
    mode: emailMode.value,
    hasEmail: Boolean(email),
    passwordLen: password.length,
    configured: configured.value
  });
  if (!configured.value) return;
  if (!email || password.length < 6) return;
  const session =
    emailMode.value === "register"
      ? await registerWithEmail(email, password)
      : await signInWithEmail(email, password);
  console.info("[hexald:link-account] email result", {
    ok: Boolean(session),
    kind: session?.kind ?? null,
    authError: authError.value
  });
  if (session && session.kind === "firebase") {
    open.value = false;
    emit("linked");
  }
}

function onSkip() {
  console.info("[hexald:link-account] skip/close");
  open.value = false;
  emit("dismiss");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="link-account">
      <div
        v-if="open"
        class="link-account-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-account-title"
      >
        <button
          type="button"
          class="link-account-backdrop"
          aria-label="Fermer"
          @click="onSkip"
        />
        <div class="link-account-card">
          <div class="link-account-card__handle" aria-hidden="true" />
          <div class="link-account-card__icon" aria-hidden="true">
            <UIcon name="i-lucide-cloud-upload" class="size-7" />
          </div>
          <h2 id="link-account-title" class="link-account-card__title">
            Sauvegarde ta progression
          </h2>
          <p class="link-account-card__body">
            Tu joues en invité. Lie un compte Google ou email pour retrouver ton
            village sur un autre appareil.
          </p>

          <p v-if="!configured" class="link-account-card__error">
            Connexion indisponible : Firebase n’est pas configuré sur ce serveur
            (vars <code>NUXT_PUBLIC_FIREBASE_*</code> manquantes au build).
            Ouvre la console (F12) — logs
            <code>[hexald:link-account]</code>.
          </p>
          <p
            v-if="!configured"
            class="link-account-card__debug"
            aria-hidden="true"
          >
            apiKey={{ firebaseDebug.hasApiKey ? "ok" : "manquant" }}
            · domain={{ firebaseDebug.hasAuthDomain ? firebaseDebug.authDomain : "manquant" }}
            · project={{ firebaseDebug.hasProjectId ? firebaseDebug.projectId : "manquant" }}
            · appId={{ firebaseDebug.hasAppId ? "ok" : "manquant" }}
          </p>

          <p v-if="authError" class="link-account-card__error">
            {{ authError }}
          </p>

          <div class="link-account-card__actions">
            <button
              type="button"
              class="link-account-btn link-account-btn--primary"
              :disabled="authBusy || !configured"
              @click="onGoogle"
            >
              <UIcon name="i-lucide-chrome" class="size-4" aria-hidden="true" />
              {{ authBusy ? "…" : "Continuer avec Google" }}
            </button>

            <button
              type="button"
              class="link-account-btn link-account-btn--ghost"
              :disabled="authBusy || !configured"
              @click="emailPanelOpen = !emailPanelOpen"
            >
              <UIcon name="i-lucide-mail" class="size-4" aria-hidden="true" />
              Email et mot de passe
            </button>

            <form
              v-if="emailPanelOpen && configured"
              class="link-account-email"
              @submit.prevent="onEmailSubmit"
            >
              <div class="link-account-email__modes">
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
                  Créer
                </button>
              </div>
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
                class="link-account-btn link-account-btn--primary"
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

            <button
              type="button"
              class="link-account-skip"
              :disabled="authBusy"
              @click="onSkip"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.link-account-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.link-account-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(28 43 40 / 0.42);
  cursor: pointer;
}

.link-account-card {
  position: relative;
  z-index: 1;
  width: min(100%, 28rem);
  border-radius: 1.5rem 1.5rem 0 0;
  background: rgb(255 255 255 / 0.94);
  box-shadow: 0 -16px 48px rgb(28 43 40 / 0.14);
  padding: 0.75rem 1.35rem calc(1.25rem + env(safe-area-inset-bottom));
  text-align: center;
}

.link-account-card__handle {
  width: 2.5rem;
  height: 0.28rem;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: rgb(28 43 40 / 0.15);
}

.link-account-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  border-radius: 999px;
  background: #e8f0ec;
  color: #2d5248;
}

.link-account-card__title {
  margin: 0;
  font-family: var(--font-display, Fraunces, serif);
  font-size: 1.35rem;
  font-weight: 500;
  color: #1c2b28;
}

.link-account-card__body {
  margin: 0.55rem 0 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: #3d524c;
}

.link-account-card__error {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: #9b4a4a;
}

.link-account-card__debug {
  margin: 0.45rem 0 0;
  font-size: 0.7rem;
  line-height: 1.35;
  color: #6b7c76;
  word-break: break-all;
}

.link-account-card__error code,
.link-account-card__debug code {
  font-size: 0.68rem;
}

.link-account-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.15rem;
}

.link-account-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 2.75rem;
  width: 100%;
  border-radius: 999px;
  border: 0;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.link-account-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.link-account-btn--primary {
  background: #2d5248;
  color: #f2f7f4;
}

.link-account-btn--primary:hover:not(:disabled) {
  background: #243f38;
}

.link-account-btn--ghost {
  background: rgb(255 255 255 / 0.85);
  color: #1c2b28;
  box-shadow: inset 0 0 0 1px rgb(28 43 40 / 0.1);
}

.link-account-btn--ghost:hover:not(:disabled) {
  background: #fff;
}

.link-account-email {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.65rem;
  border-radius: 1rem;
  background: rgb(232 240 236 / 0.65);
}

.link-account-email__modes {
  display: flex;
  gap: 0.35rem;
}

.link-account-email__modes button {
  border: 0;
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7c76;
  background: transparent;
  cursor: pointer;
}

.link-account-email__modes button.is-active {
  background: #2d5248;
  color: #f2f7f4;
}

.link-account-email input {
  height: 2.5rem;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 0 1rem;
  font-size: 0.875rem;
  color: #1c2b28;
  background: rgb(255 255 255 / 0.9);
  box-shadow: inset 0 0 0 1px rgb(28 43 40 / 0.08);
  outline: none;
}

.link-account-skip {
  border: 0;
  background: transparent;
  color: #6b7c76;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.35rem;
}

.link-account-skip:hover:not(:disabled) {
  color: #1c2b28;
}

.link-account-enter-active,
.link-account-leave-active {
  transition: opacity 0.2s ease;
}

.link-account-enter-active .link-account-card,
.link-account-leave-active .link-account-card {
  transition: transform 0.26s ease, opacity 0.22s ease;
}

.link-account-enter-from,
.link-account-leave-to {
  opacity: 0;
}

.link-account-enter-from .link-account-card,
.link-account-leave-to .link-account-card {
  opacity: 0;
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .link-account-overlay {
    align-items: center;
    padding: 1.25rem;
  }

  .link-account-card {
    width: min(100%, 22rem);
    border-radius: 1.5rem;
    box-shadow: 0 24px 60px rgb(28 43 40 / 0.18);
    padding: 1.5rem 1.35rem 1.25rem;
  }

  .link-account-card__handle {
    display: none;
  }

  .link-account-enter-from .link-account-card,
  .link-account-leave-to .link-account-card {
    transform: translateY(0.65rem) scale(0.98);
  }
}
</style>
