<script setup lang="ts">
definePageMeta({
  layout: "blank"
});

useHead({
  title: "Admin · Hexald"
});

type AdminGate = "loading" | "login" | "forbidden" | "ready";

type AdminOverview = {
  generatedAt: string;
  presenceTtlMs: number;
  supportMail?: {
    isDev: boolean;
    configured: boolean;
    to: string;
    from: string;
  };
  counts: {
    playersTotal: number;
    playersNamed: number;
    worldsTotal: number;
    online: number;
    content: {
      biomes: number;
      resources: number;
      buildings: number;
      chains: number;
    };
  };
  online: Array<{
    playerId: string;
    pseudo: string | null;
    kind: string;
    lastSeenAt: string;
  }>;
  recentPlayers: Array<{
    id: string;
    kind: string;
    pseudo: string | null;
    createdAt: string;
  }>;
  recentWorlds: Array<{
    id: string;
    ownerId: string;
    ownerPseudo: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type TestMailResult = {
  ok: true;
  mode: "resend" | "log";
  to: string;
  from: string;
};

const config = useRuntimeConfig();
const { kind, email, probeSession } = useSession();
const {
  configured: firebaseConfigured,
  authBusy,
  authError,
  ensureHexaldSession,
  signInWithGoogle,
  signInWithEmail,
  watchAuth
} = useFirebaseAuth();

const gate = ref<AdminGate>("loading");
const gateMessage = ref<string | null>(null);
const testMailBusy = ref(false);
const testMailStatus = ref<string | null>(null);

const emailPanelOpen = ref(false);
const emailMode = ref<"login" | "register">("login");
const emailDraft = ref("");
const passwordDraft = ref("");

const {
  data,
  pending,
  error,
  refresh
} = await useAsyncData(
  "admin-overview",
  () =>
    $fetch<AdminOverview>("/v1/admin/overview", {
      baseURL: config.public.apiBase,
      credentials: "include"
    }),
  { server: false, immediate: false }
);

let timer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  void refresh();
  timer = setInterval(() => {
    void refresh();
  }, 10_000);
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function resolveGate() {
  gateMessage.value = null;
  gate.value = "loading";

  if (!firebaseConfigured.value) {
    gate.value = "forbidden";
    gateMessage.value =
      "Firebase n’est pas configuré côté client. Ajoute NUXT_PUBLIC_FIREBASE_* dans apps/web/.env.";
    return;
  }

  watchAuth();
  await ensureHexaldSession();

  const session = await probeSession();
  if (!session || session.kind !== "firebase") {
    gate.value = "login";
    return;
  }

  if (!session.isAdmin) {
    gate.value = "forbidden";
    gateMessage.value =
      "Ce compte n’a pas accès admin. Demande l’ajout de ton email dans ADMIN_EMAILS (API).";
    return;
  }

  gate.value = "ready";
  startPolling();
}

async function onGoogleLogin() {
  const session = await signInWithGoogle();
  if (session?.isAdmin) {
    await resolveGate();
  } else if (session && !session.isAdmin) {
    gate.value = "forbidden";
    gateMessage.value = "Compte connecté, mais pas autorisé admin.";
  }
}

async function onEmailSubmit() {
  const addr = emailDraft.value.trim();
  const password = passwordDraft.value;
  if (!addr || password.length < 6) return;
  const session = await signInWithEmail(addr, password);
  if (session?.isAdmin) {
    await resolveGate();
  } else if (session && !session.isAdmin) {
    gate.value = "forbidden";
    gateMessage.value = "Compte connecté, mais pas autorisé admin.";
  }
}

onMounted(() => {
  void resolveGate();
});

onBeforeUnmount(() => {
  stopPolling();
});

watch(error, (err) => {
  if (!err || gate.value !== "ready") return;
  const status =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode?: number }).statusCode)
      : 0;
  if (status === 401 || status === 403) {
    stopPolling();
    void resolveGate();
  }
});

function formatWhen(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function shortId(id: string) {
  return id.slice(0, 8);
}

const ttlMinutes = computed(() =>
  Math.round((data.value?.presenceTtlMs ?? 300_000) / 60_000)
);

const showTestMail = computed(() => data.value?.supportMail?.isDev === true);

async function sendTestMail() {
  if (testMailBusy.value || !showTestMail.value) return;
  testMailBusy.value = true;
  testMailStatus.value = null;
  try {
    const result = await $fetch<TestMailResult>("/v1/admin/test-mail", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include"
    });
    if (result.mode === "resend") {
      testMailStatus.value = `Envoyé via Resend → ${result.to}`;
    } else {
      testMailStatus.value = `Pas de RESEND_API_KEY — contenu loggé côté API (→ ${result.to})`;
    }
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;
    if (status === 401 || status === 403) {
      testMailStatus.value = "Session admin expirée ou refusée.";
      stopPolling();
      void resolveGate();
    } else if (status === 503) {
      testMailStatus.value = "RESEND_API_KEY manquante.";
    } else {
      testMailStatus.value = "Échec d’envoi — vérifie Resend / domaine / logs API.";
    }
  } finally {
    testMailBusy.value = false;
  }
}
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
        <UButton
          color="primary"
          block
          :loading="authBusy"
          @click="onGoogleLogin"
        >
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
            <button
              type="button"
              class="rounded-md px-2 py-1"
              :class="emailMode === 'login' ? 'bg-[#2d5248] text-white' : 'text-[#6b7c76]'"
              @click="emailMode = 'login'"
            >
              Connexion
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-[#6b7c76]"
              disabled
              title="Crée un compte joueur sur la landing, puis ajoute l’email dans ADMIN_EMAILS"
            >
              Inscription (via le jeu)
            </button>
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

    <div v-else class="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header class="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-display text-sm tracking-[0.18em] text-[#4a7c6f] uppercase">
            Hexald
          </p>
          <h1 class="font-display mt-1 text-3xl font-medium tracking-tight sm:text-4xl">
            Admin
          </h1>
          <p class="mt-2 max-w-xl text-[#6b7c76]">
            Stats live, présence approximative ({{ ttlMinutes }}&nbsp;min).
            <NuxtLink
              to="/admin/content"
              class="ml-1 text-[#4a7c6f] underline-offset-2 hover:underline"
            >
              Parcourir le contenu 3D
            </NuxtLink>
          </p>
          <p v-if="email" class="mt-1 text-xs text-[#6b7c76]">
            {{ email }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <p v-if="data" class="text-sm text-[#6b7c76]">
            Maj {{ formatWhen(data.generatedAt) }}
          </p>
          <UButton color="primary" variant="soft" to="/admin/content">
            Contenu
          </UButton>
          <UButton
            v-if="showTestMail"
            color="primary"
            variant="soft"
            :loading="testMailBusy"
            @click="sendTestMail"
          >
            Tester l’envoi mail
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            :loading="pending"
            @click="refresh()"
          >
            Rafraîchir
          </UButton>
        </div>
      </header>

      <p
        v-if="testMailStatus"
        class="mb-6 rounded-lg px-4 py-3 text-sm"
        :class="
          testMailStatus.startsWith('Envoyé')
            ? 'bg-emerald-100 text-emerald-900'
            : 'bg-amber-100 text-amber-950'
        "
      >
        {{ testMailStatus }}
        <span v-if="data?.supportMail" class="mt-1 block text-xs opacity-80">
          From {{ data.supportMail.from }} · Resend
          {{ data.supportMail.configured ? "configuré" : "non configuré" }}
        </span>
      </p>

      <p v-if="error" class="rounded-lg bg-red-100 px-4 py-3 text-red-900">
        Impossible de charger l’overview admin.
      </p>

      <template v-else-if="data">
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="stat">
            <p class="stat-label">En ligne</p>
            <p class="stat-value">{{ data.counts.online }}</p>
          </div>
          <div class="stat">
            <p class="stat-label">Joueurs</p>
            <p class="stat-value">{{ data.counts.playersNamed }}</p>
            <p class="stat-meta">{{ data.counts.playersTotal }} sessions au total</p>
          </div>
          <div class="stat">
            <p class="stat-label">Mondes</p>
            <p class="stat-value">{{ data.counts.worldsTotal }}</p>
          </div>
          <div class="stat">
            <p class="stat-label">Contenu</p>
            <p class="stat-value">{{ data.counts.content.buildings }}</p>
            <p class="stat-meta">
              {{ data.counts.content.biomes }} biomes ·
              {{ data.counts.content.resources }} ressources ·
              {{ data.counts.content.chains }} chaînes
            </p>
          </div>
        </section>

        <div class="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 class="font-display text-xl font-medium">Joueurs en ligne</h2>
            <p class="mt-1 text-sm text-[#6b7c76]">
              Activité API récente (session / mondes / actions).
            </p>

            <ul v-if="data.online.length" class="mt-4 divide-y divide-[#1c2b28]/10 border-t border-[#1c2b28]/10">
              <li
                v-for="player in data.online"
                :key="player.playerId"
                class="flex items-center justify-between gap-3 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ player.pseudo }}
                  </p>
                  <p class="truncate font-mono text-xs text-[#6b7c76]">
                    {{ shortId(player.playerId) }}
                  </p>
                </div>
                <p class="shrink-0 text-sm text-[#6b7c76]">
                  {{ formatWhen(player.lastSeenAt) }}
                </p>
              </li>
            </ul>
            <p v-else class="mt-4 text-sm text-[#6b7c76]">
              Personne en ligne pour le moment.
            </p>
          </section>

          <section>
            <h2 class="font-display text-xl font-medium">Derniers joueurs</h2>
            <p class="mt-1 text-sm text-[#6b7c76]">Comptes nommés les plus récents.</p>

            <ul
              v-if="data.recentPlayers.length"
              class="mt-4 divide-y divide-[#1c2b28]/10 border-t border-[#1c2b28]/10"
            >
              <li
                v-for="player in data.recentPlayers"
                :key="player.id"
                class="flex items-center justify-between gap-3 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ player.pseudo }}
                  </p>
                  <p class="truncate font-mono text-xs text-[#6b7c76]">
                    {{ shortId(player.id) }} · {{ player.kind }}
                  </p>
                </div>
                <p class="shrink-0 text-sm text-[#6b7c76]">
                  {{ formatWhen(player.createdAt) }}
                </p>
              </li>
            </ul>
            <p v-else class="mt-4 text-sm text-[#6b7c76]">
              Aucun compte nommé pour le moment.
            </p>
          </section>
        </div>

        <section class="mt-10">
          <h2 class="font-display text-xl font-medium">Mondes récents</h2>
          <p class="mt-1 text-sm text-[#6b7c76]">Triés par dernière mise à jour.</p>

          <div class="mt-4 overflow-x-auto border-t border-[#1c2b28]/10">
            <table class="w-full min-w-[36rem] text-left text-sm">
              <thead class="text-[#6b7c76]">
                <tr class="border-b border-[#1c2b28]/10">
                  <th class="py-3 pr-4 font-medium">Monde</th>
                  <th class="py-3 pr-4 font-medium">Propriétaire</th>
                  <th class="py-3 pr-4 font-medium">Créé</th>
                  <th class="py-3 font-medium">Maj</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="world in data.recentWorlds"
                  :key="world.id"
                  class="border-b border-[#1c2b28]/8"
                >
                  <td class="py-3 pr-4 font-mono text-xs">
                    {{ shortId(world.id) }}
                  </td>
                  <td class="py-3 pr-4">
                    {{ world.ownerPseudo ?? shortId(world.ownerId) }}
                  </td>
                  <td class="py-3 pr-4 text-[#6b7c76]">
                    {{ formatWhen(world.createdAt) }}
                  </td>
                  <td class="py-3 text-[#6b7c76]">
                    {{ formatWhen(world.updatedAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <p v-else-if="pending" class="text-[#6b7c76]">Chargement…</p>
    </div>
  </div>
</template>

<style scoped>
.admin {
  position: relative;
  overflow: hidden;
}

.admin-glow {
  pointer-events: none;
  position: absolute;
  inset: -20% auto auto -10%;
  width: min(48rem, 90vw);
  height: min(32rem, 70vh);
  background:
    radial-gradient(closest-side, rgb(74 124 111 / 0.22), transparent 70%),
    radial-gradient(closest-side, rgb(232 240 236 / 0.9), transparent 75%);
  filter: blur(8px);
}

.stat {
  border-top: 1px solid rgb(28 43 40 / 0.14);
  padding-top: 1rem;
}

.stat-label {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7c76;
}

.stat-value {
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
}

.stat-meta {
  margin-top: 0.45rem;
  font-size: 0.85rem;
  color: #6b7c76;
}
</style>
