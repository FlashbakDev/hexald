<script setup lang="ts">
definePageMeta({
  layout: "default"
});

usePageSeo({
  title: "Guide Hexald — comment jouer, biomes et early game",
  description:
    "Guide Hexald : premiers pas, biomes (forêt, plaine, montagne, eau), production, recherche et points de civilisation. Apprends à bâtir ton empire hexagonal.",
  path: "/guide"
});

useBreadcrumbSchema([
  { name: "Accueil", item: "/" },
  { name: "Guide", item: "/guide" }
]);

useSchemaOrg([
  defineWebPage({
    name: "Guide Hexald — comment jouer",
    description:
      "Premiers pas, biomes, production et points de civilisation."
  })
]);
</script>

<template>
  <div class="min-h-dvh bg-[#dfe8e4] text-[#1c2b28]">
    <header class="guide-header">
      <div class="landing-col guide-header__inner">
        <NuxtLink
          to="/"
          class="font-display text-xl font-medium tracking-tight text-[#1c2b28] transition hover:text-[#2d5248]"
        >
          Hexald
        </NuxtLink>
        <SiteTopNav />
      </div>
    </header>

    <main class="landing-col pb-20 pt-10 sm:pt-14">
      <p class="mb-2 text-sm font-semibold tracking-wide text-[#4a7c6f]">
        Guide
      </p>
      <h1 class="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Comment jouer à Hexald
      </h1>
      <p class="mt-4 max-w-2xl text-lg leading-relaxed text-[#3d524c]">
        Hexald est un jeu de gestion / stratégie persistant par navigateur.
        Tu poses un village, tu produis des ressources, tu recherches des
        technologies et tu étends ton monde hexagonal — à ton rythme, même
        hors ligne côté serveur.
      </p>

      <nav class="guide-toc" aria-label="Sommaire">
        <a href="#premiers-pas">Premiers pas</a>
        <a href="#biomes">Biomes</a>
        <a href="#production">Production</a>
        <a href="#civilisation">Civilisation &amp; score</a>
      </nav>

      <section id="premiers-pas" class="guide-section">
        <h2 class="font-display">Premiers pas</h2>
        <p>
          Au démarrage tu reçois un village central, une population de base et
          une production de nourriture de subsistance. Assigne des ouvriers aux
          extracteurs (camp, ferme, carrière…) pour stocker du bois, du blé et
          de la pierre. Construis des maisons pour relever le plafond de
          population, puis choisis la prochaine région à révéler.
        </p>
        <ol>
          <li>Réclame un pseudo et entre dans ton monde.</li>
          <li>Pose un camp en forêt et assigne un ouvrier.</li>
          <li>Ouvre l’arbre technologique et lance une première recherche.</li>
          <li>Étends une région voisine avec des éclats de monde.</li>
        </ol>
        <p>
          Pour le détail live des nouveautés, vois les
          <NuxtLink to="/news">actualités</NuxtLink>.
        </p>
      </section>

      <section id="biomes" class="guide-section">
        <h2 class="font-display">Biomes</h2>
        <p>
          Chaque région a un biome primaire. Les bordures terre↔terre créent des
          fusions (lisière, piémont, haute forêt) qui bonusent la production.
          L’eau ouvre la pêche ; la montagne mène à la pierre et au minerai de fer.
        </p>
        <ul>
          <li><strong>Forêt</strong> — bois (camp de bûcherons).</li>
          <li><strong>Plaine</strong> — blé, pâturages, argile.</li>
          <li><strong>Montagne</strong> — pierre, gisements de fer (mine).</li>
          <li><strong>Eau</strong> — bancs de poissons et quai de pêche.</li>
        </ul>
        <p>
          Tu choisis le biome de la prochaine région : la carte grandit dans la
          direction que tu décides.
        </p>
      </section>

      <section id="production" class="guide-section">
        <h2 class="font-display">Production &amp; recherche</h2>
        <p>
          L’économie est une chaîne : extracteurs → transformateurs → outils et
          nourriture. Rien n’est magique dans l’inventaire — il faut des sites
          actifs (ouvriers assignés) et de la place en stock. La science n’est
          pas une ressource stockée : l’hôtel de ville (et plus tard les centres
          de recherche) avance ta cible technologique.
        </p>
      </section>

      <section id="civilisation" class="guide-section">
        <h2 class="font-display">Civilisation &amp; classement</h2>
        <p>
          Les <strong>points de civilisation (PC)</strong> mesurent l’ampleur de
          ton empire :
          Science + Production + Population + Militaire. La population compte
          ×&nbsp;10 ; les technologies débloquées ajoutent leur coût science ;
          chaque bâtiment actif (avec ouvrier) rapporte selon sa catégorie.
        </p>
        <p>
          Le <NuxtLink to="/leaderboard">classement</NuxtLink> ne retient que
          les comptes inscrits. Territoire et influence ne rentrent pas encore
          dans le score.
        </p>
      </section>

      <p class="guide-cta">
        <NuxtLink to="/" class="guide-cta__btn">
          Jouer à Hexald
        </NuxtLink>
      </p>
    </main>

    <SiteFooter variant="section" />
  </div>
</template>

<style scoped>
.guide-header {
  border-bottom: 1px solid rgb(28 43 40 / 0.1);
  background: rgb(223 232 228 / 0.85);
  backdrop-filter: blur(10px);
}

.guide-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.guide-toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.guide-toc a {
  color: #2d5248;
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.guide-section {
  margin-top: 2.5rem;
  max-width: 42rem;
}

.guide-section h2 {
  font-size: 1.65rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.guide-section p,
.guide-section li {
  color: #3d524c;
  line-height: 1.65;
}

.guide-section p + p,
.guide-section p + ol,
.guide-section p + ul {
  margin-top: 0.85rem;
}

.guide-section ol,
.guide-section ul {
  margin: 0.85rem 0 0;
  padding-left: 1.25rem;
}

.guide-section li + li {
  margin-top: 0.35rem;
}

.guide-section a {
  color: #2d5248;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15rem;
}

.guide-cta {
  margin-top: 3rem;
}

.guide-cta__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  padding: 0 2rem;
  border-radius: 999px;
  background: #2d5248;
  color: #f2f7f4;
  font-family: var(--font-display, Fraunces, Georgia, serif);
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease;
}

.guide-cta__btn:hover {
  background: #243f38;
}
</style>
