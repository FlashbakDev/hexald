<script setup lang="ts">
/**
 * Écran loading / login / forbidden partagé admin.
 * Slot rendu uniquement quand gate === ready.
 */
const props = defineProps<{
  onReady?: () => void;
  onLeaveReady?: () => void;
}>();

const {
  gate,
  gateMessage,
  kind,
  email,
  authBusy,
  authError,
  emailPanelOpen,
  emailDraft,
  passwordDraft,
  resolveGate,
  onGoogleLogin,
  onEmailSubmit
} = useAdminGate({
  onReady: () => props.onReady?.(),
  onLeaveReady: () => props.onLeaveReady?.()
});

defineExpose({ gate, resolveGate, email });
</script>

<template>
  <div class="admin min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <div class="admin-glow" aria-hidden="true" />

    <div
      v-if="gate === 'loading'"
      class="relative flex min-h-dvh items-center justify-center px-6 text-[#6b7c76]"
    >
      Chargement…
    </div>

    <div
      v-else-if="gate === 'login'"
      class="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12"
    >
      <p class="font-display text-sm tracking-[0.18em] text-[#4a7c6f] uppercase">
        Hexald
      </p>
      <h1 class="font-display mt-2 text-3xl font-medium tracking-tight">
        Connexion admin
      </h1>
      <p class="mt-3 text-sm text-[#6b7c76]">
        Utilise le même compte Google ou email que pour le jeu. Seuls les emails
        listés dans <code class="text-xs">ADMIN_EMAILS</code> côté API sont autorisés.
      </p>

      <p v-if="authError" class="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-900">
        {{ authError }}
      </p>

      <div class="mt-6 flex flex-col gap-3">
        <UButton color="primary" block :loading="authBusy" @click="onGoogleLogin">
          Continuer avec Google
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          block
          :disabled="authBusy"
          @click="emailPanelOpen = !emailPanelOpen"
        >
          Email et mot de passe
        </UButton>

        <form
          v-if="emailPanelOpen"
          class="mt-2 space-y-3 rounded-xl border border-[#1c2b28]/10 bg-white/60 p-4"
          @submit.prevent="onEmailSubmit"
        >
          <div class="flex gap-2 text-sm">
            <span class="rounded-md bg-[#2d5248] px-2 py-1 text-white">Connexion</span>
            <span
              class="rounded-md px-2 py-1 text-[#6b7c76]"
              title="Crée un compte joueur sur la landing, puis ajoute l’email dans ADMIN_EMAILS"
            >
              Inscription (via le jeu)
            </span>
          </div>
          <UInput v-model="emailDraft" type="email" placeholder="Email" autocomplete="email" />
          <UInput
            v-model="passwordDraft"
            type="password"
            placeholder="Mot de passe"
            autocomplete="current-password"
          />
          <UButton type="submit" color="primary" block :loading="authBusy">
            Se connecter
          </UButton>
        </form>

        <NuxtLink
          to="/"
          class="mt-4 text-center text-sm text-[#6b7c76] underline-offset-2 hover:underline"
        >
          Retour au jeu
        </NuxtLink>
      </div>
    </div>

    <div
      v-else-if="gate === 'forbidden'"
      class="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12"
    >
      <h1 class="font-display text-2xl font-medium">Accès refusé</h1>
      <p class="mt-3 text-sm text-[#6b7c76]">
        {{ gateMessage ?? "Tu n’as pas les droits admin." }}
      </p>
      <p v-if="email && kind === 'firebase'" class="mt-2 text-xs text-[#6b7c76]">
        Connecté en tant que {{ email }}.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UButton color="neutral" variant="soft" @click="resolveGate()">
          Réessayer
        </UButton>
        <UButton color="neutral" variant="ghost" to="/">
          Retour
        </UButton>
      </div>
    </div>

    <slot v-else :email="email" :resolve-gate="resolveGate" />
  </div>
</template>

<style scoped>
.admin-glow {
  pointer-events: none;
  position: fixed;
  inset: -20% auto auto 40%;
  width: min(70vw, 640px);
  height: min(70vw, 640px);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(74 124 111 / 0.18),
    transparent 70%
  );
  filter: blur(8px);
}
</style>
