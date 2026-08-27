<script setup lang="ts">
import type { LeaderboardEntrySnapshot } from "@hexald/shared";
import {
  fetchLeaderboard,
  LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_SCORE_LABEL
} from "~/data/leaderboard";

definePageMeta({
  layout: "default"
});

useHead({
  title: "Classement · Hexald"
});

const route = useRoute();
const router = useRouter();

const page = computed(() => {
  const raw = Number.parseInt(String(route.query.page ?? "1"), 10);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
});

const { data, pending, error, refresh } = await useAsyncData(
  "leaderboard",
  () => fetchLeaderboard({ page: page.value, pageSize: LEADERBOARD_PAGE_SIZE }),
  { watch: [page] }
);

const entries = computed(() => data.value?.entries ?? []);
const scoreLabel = computed(
  () => data.value?.scoreLabel ?? LEADERBOARD_SCORE_LABEL
);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => data.value?.totalPages ?? 1);
const currentPage = computed(() => data.value?.page ?? page.value);

const podium = computed(() => {
  if (currentPage.value !== 1) return [];
  const byRank = Object.fromEntries(
    entries.value
      .filter((e) => e.rank <= 3)
      .map((e) => [e.rank, e])
  ) as Record<number, LeaderboardEntrySnapshot>;
  return [byRank[2], byRank[1], byRank[3]].filter(Boolean);
});

const rangeLabel = computed(() => {
  if (total.value === 0) return "0 joueur";
  const start = (currentPage.value - 1) * LEADERBOARD_PAGE_SIZE + 1;
  const end = Math.min(currentPage.value * LEADERBOARD_PAGE_SIZE, total.value);
  return `${start}–${end} sur ${total.value}`;
});

function goToPage(next: number) {
  const clamped = Math.min(Math.max(1, next), totalPages.value);
  if (clamped === 1) {
    void router.push({ path: "/leaderboard", query: {} });
    return;
  }
  void router.push({ path: "/leaderboard", query: { page: String(clamped) } });
}
</script>

<template>
  <div class="min-h-dvh bg-[#dfe8e4] text-[#1c2b28]">
    <header class="lb-header">
      <div class="landing-col lb-header__inner">
        <NuxtLink
          to="/"
          class="font-display text-xl font-medium tracking-tight text-[#1c2b28] transition hover:text-[#2d5248]"
        >
          Hexald
        </NuxtLink>
        <nav class="lb-header__nav" aria-label="Navigation">
          <NuxtLink to="/" class="lb-header__link">Accueil</NuxtLink>
          <NuxtLink
            to="/leaderboard"
            class="lb-header__link is-active"
            aria-current="page"
          >
            Classement
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="landing-col pb-20 pt-10 sm:pt-14">
      <p class="mb-2 text-sm font-semibold tracking-wide text-[#4a7c6f]">
        Classement
      </p>
      <h1 class="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Les plus grands empires
      </h1>
      <p class="mt-3 max-w-xl text-[#3d524c]">
        Classés par points de civilisation (PC) :
        Science + Production + Population + Militaire.
        Comptes inscrits uniquement.
      </p>

      <p v-if="pending" class="mt-10 text-sm text-[#3d524c]">
        Chargement du classement…
      </p>
      <p v-else-if="error" class="mt-10 text-sm text-[#8b3a3a]">
        Impossible de charger le classement.
        <button
          type="button"
          class="ml-2 underline"
          @click="() => refresh()"
        >
          Réessayer
        </button>
      </p>
      <template v-else>
        <section
          v-if="podium.length > 0"
          class="lb-podium"
          aria-label="Podium"
        >
          <article
            v-for="entry in podium"
            :key="entry.rank"
            class="lb-podium__slot"
            :class="`lb-podium__slot--${entry.rank}`"
          >
            <span class="lb-podium__rank" aria-hidden="true">{{ entry.rank }}</span>
            <h2 class="lb-podium__name font-display">{{ entry.pseudo }}</h2>
            <p class="lb-podium__score">
              {{ entry.score.toLocaleString("fr-FR") }}
              <span>{{ scoreLabel }}</span>
            </p>
          </article>
        </section>

        <section class="lb-list" aria-labelledby="lb-list-title">
          <div class="lb-list__head">
            <h2 id="lb-list-title" class="lb-list__title font-display">
              Classement
            </h2>
            <p class="lb-list__range">{{ rangeLabel }}</p>
          </div>
          <ol v-if="entries.length > 0" class="lb-list__rows">
            <li
              v-for="entry in entries"
              :key="entry.rank"
              class="lb-list__row"
            >
              <span class="lb-list__rank">{{ entry.rank }}</span>
              <span class="lb-list__pseudo">{{ entry.pseudo }}</span>
              <span class="lb-list__score">
                {{ entry.score.toLocaleString("fr-FR") }}
              </span>
            </li>
          </ol>
          <p v-else class="lb-list__note">
            Aucun joueur classé pour le moment — crée un compte et développe ta
            civilisation.
          </p>

          <nav
            v-if="totalPages > 1"
            class="lb-pager"
            aria-label="Pagination du classement"
          >
            <button
              type="button"
              class="lb-pager__btn"
              :disabled="currentPage <= 1"
              @click="goToPage(currentPage - 1)"
            >
              Précédent
            </button>
            <p class="lb-pager__status">
              Page {{ currentPage }} / {{ totalPages }}
            </p>
            <button
              type="button"
              class="lb-pager__btn"
              :disabled="currentPage >= totalPages"
              @click="goToPage(currentPage + 1)"
            >
              Suivant
            </button>
          </nav>

          <p v-if="entries.length > 0" class="lb-list__note">
            {{ LEADERBOARD_PAGE_SIZE }} joueurs par page · {{ scoreLabel }}
          </p>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.lb-header {
  border-bottom: 1px solid rgb(28 43 40 / 0.1);
  background: rgb(223 232 228 / 0.85);
  backdrop-filter: blur(10px);
}

.lb-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.lb-header__nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lb-header__link {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(61 82 76);
  text-decoration: none;
}

.lb-header__link:hover {
  color: #1c2b28;
}

.lb-header__link.is-active {
  color: #1c2b28;
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.lb-podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
  margin-top: 2.5rem;
}

.lb-podium__slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem 0.75rem 1.5rem;
  border-radius: 1rem 1rem 0.35rem 0.35rem;
  background: rgb(255 255 255 / 0.45);
  border: 1px solid rgb(28 43 40 / 0.08);
}

.lb-podium__slot--1 {
  padding-top: 2rem;
  background: rgb(255 255 255 / 0.7);
  order: 2;
}

.lb-podium__slot--2 {
  order: 1;
  min-height: 8.5rem;
}

.lb-podium__slot--3 {
  order: 3;
  min-height: 7.5rem;
}

.lb-podium__rank {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgb(74 124 111 / 0.15);
  color: #2d5248;
}

.lb-podium__slot--1 .lb-podium__rank {
  background: rgb(201 162 39 / 0.25);
  color: #6b5200;
}

.lb-podium__name {
  margin-top: 0.75rem;
  font-size: 1.15rem;
  font-weight: 500;
}

.lb-podium__score {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d5248;
}

.lb-podium__score span {
  margin-left: 0.2rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(61 82 76 / 0.75);
}

.lb-list {
  margin-top: 2.5rem;
}

.lb-list__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.lb-list__title {
  font-size: 1.35rem;
  font-weight: 500;
  margin: 0;
}

.lb-list__range {
  margin: 0;
  font-size: 0.85rem;
  color: rgb(61 82 76 / 0.85);
}

.lb-list__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid rgb(28 43 40 / 0.1);
}

.lb-list__row {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid rgb(28 43 40 / 0.08);
}

.lb-list__rank {
  font-weight: 700;
  color: #4a7c6f;
}

.lb-list__pseudo {
  font-weight: 600;
}

.lb-list__score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #2d5248;
}

.lb-list__note {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: rgb(61 82 76 / 0.85);
}

.lb-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.25rem;
}

.lb-pager__btn {
  border: 1px solid rgb(28 43 40 / 0.15);
  background: rgb(255 255 255 / 0.55);
  color: #1c2b28;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.5rem 0.9rem;
  border-radius: 0.45rem;
  cursor: pointer;
}

.lb-pager__btn:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.85);
}

.lb-pager__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lb-pager__status {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #2d5248;
}

@media (max-width: 640px) {
  .lb-podium {
    grid-template-columns: 1fr;
  }

  .lb-podium__slot--1,
  .lb-podium__slot--2,
  .lb-podium__slot--3 {
    order: unset;
    min-height: 0;
  }
}
</style>
