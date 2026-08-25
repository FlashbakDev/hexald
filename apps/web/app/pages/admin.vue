<script setup lang="ts">
definePageMeta({
  layout: "blank"
});

useHead({
  title: "Admin · Hexald"
});

type AdminOverview = {
  generatedAt: string;
  presenceTtlMs: number;
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

const config = useRuntimeConfig();

const {
  data,
  pending,
  error,
  refresh
} = await useAsyncData(
  "admin-overview",
  () =>
    $fetch<AdminOverview>("/v1/admin/overview", {
      baseURL: config.public.apiBase
    }),
  { server: false }
);

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    void refresh();
  }, 10_000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
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
</script>

<template>
  <div class="admin min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <div class="admin-glow" aria-hidden="true" />

    <div class="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header class="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-display text-sm tracking-[0.18em] text-[#4a7c6f] uppercase">
            Hexald
          </p>
          <h1 class="font-display mt-1 text-3xl font-medium tracking-tight sm:text-4xl">
            Admin
          </h1>
          <p class="mt-2 max-w-xl text-[#6b7c76]">
            Stats live, présence approximative ({{ ttlMinutes }}&nbsp;min), sans auth pour l’instant.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <p v-if="data" class="text-sm text-[#6b7c76]">
            Maj {{ formatWhen(data.generatedAt) }}
          </p>
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
