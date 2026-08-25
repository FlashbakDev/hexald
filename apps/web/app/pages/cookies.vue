<script setup lang="ts">
definePageMeta({
  layout: "legal"
});

useHead({
  title: "Politique cookies · Hexald"
});
</script>

<template>
  <article class="legal-prose">
    <h1>Politique cookies</h1>
    <p class="lead">
      Hexald utilise un nombre limité de cookies / traceurs pour faire fonctionner le jeu.
    </p>

    <h2>1. Qu’est-ce qu’un cookie&nbsp;?</h2>
    <p>
      Un cookie est un petit fichier déposé sur votre terminal lors de la visite d’un
      site. Il permet de mémoriser des informations relatives à votre navigation.
    </p>

    <h2>2. Cookies utilisés</h2>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Finalité</th>
            <th>Durée</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>tw_sid</code></td>
            <td>
              Cookie de session signé (httpOnly) permettant d’associer votre navigateur
              à un joueur et de restaurer votre progression.
            </td>
            <td>Jusqu’à ~400 jours</td>
            <td>Essentiel</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>3. Cookies essentiels</h2>
    <p>
      Le cookie de session est strictement nécessaire au fonctionnement du service
      (authentification anonyme et persistance). Il ne nécessite pas de consentement
      préalable au sens des recommandations CNIL sur les cookies essentiels.
    </p>

    <h2>4. Mesure d’audience / publicité</h2>
    <p>
      Hexald n’utilise pas, à ce stade, de cookies publicitaires ni d’outils d’analytics
      tiers. Si cela change, cette page sera mise à jour et un mécanisme de consentement
      sera ajouté le cas échéant.
    </p>

    <h2>5. Paramétrage</h2>
    <p>
      Vous pouvez supprimer ou bloquer les cookies via les réglages de votre navigateur.
      Sans le cookie de session, vous ne pourrez pas conserver votre progression.
    </p>

    <h2>6. Plus d’informations</h2>
    <p>
      Voir aussi la
      <NuxtLink to="/privacy">politique de confidentialité</NuxtLink>
      et les
      <NuxtLink to="/legals">mentions légales</NuxtLink>.
    </p>

    <p class="note">Dernière mise à jour : 25 août 2026.</p>
  </article>
</template>
