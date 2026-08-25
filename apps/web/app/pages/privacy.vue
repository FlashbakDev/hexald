<script setup lang="ts">
definePageMeta({
  layout: "legal"
});

useHead({
  title: "Politique de confidentialité · Hexald"
});
</script>

<template>
  <article class="legal-prose">
    <h1>Politique de confidentialité</h1>
    <p class="lead">
      Cette page décrit quelles données Hexald traite, pourquoi, et vos droits.
    </p>

    <h2>1. Responsable du traitement</h2>
    <p>
      Le responsable du traitement est l’éditeur d’Hexald
      (voir <NuxtLink to="/legals">mentions légales</NuxtLink>).
      Contact privacy : <em>à compléter</em>.
    </p>

    <h2>2. Données collectées</h2>
    <ul>
      <li>
        <strong>Session</strong> : identifiant technique (cookie signé) permettant de
        vous reconnaître d’une visite à l’autre.
      </li>
      <li>
        <strong>Pseudo</strong> : nom de compte que vous choisissez, s’il est revendiqué.
      </li>
      <li>
        <strong>Données de jeu</strong> : mondes, régions, tuiles et actions liées à
        votre session.
      </li>
      <li>
        <strong>Données techniques</strong> : logs serveur limités (erreurs, santé du
        service), sans profilage publicitaire.
      </li>
    </ul>
    <p>
      Hexald ne demande pas d’adresse e-mail ni de données bancaires dans la phase
      actuelle.
    </p>

    <h2>3. Finalités</h2>
    <ul>
      <li>fournir et sécuriser le jeu (session, anti-abus) ;</li>
      <li>sauvegarder votre progression ;</li>
      <li>améliorer la stabilité et corriger les bugs.</li>
    </ul>

    <h2>4. Bases légales</h2>
    <p>
      Traitement nécessaire à l’exécution du service que vous demandez (intérêt
      légitime / mesures précontractuelles ou contractuelles selon le cas), et
      obligations de sécurité.
    </p>

    <h2>5. Destinataires</h2>
    <p>
      Les données sont traitées par l’éditeur et, le cas échéant, l’hébergeur technique.
      Elles ne sont pas vendues à des tiers.
    </p>

    <h2>6. Durée de conservation</h2>
    <p>
      La session et les données de jeu sont conservées tant que le compte / la session
      reste active, puis peuvent être purgées après inactivité prolongée ou sur demande,
      sous réserve des besoins de sécurité et d’obligations légales.
    </p>

    <h2>7. Transferts</h2>
    <p>
      Si des traitements hors UE sont nécessaires (hébergement), des garanties adaptées
      seront mises en place. Détails à compléter selon l’infrastructure retenue.
    </p>

    <h2>8. Vos droits</h2>
    <p>
      Conformément au RGPD, vous pouvez demander l’accès, la rectification, l’effacement,
      la limitation, la portabilité (lorsque applicable) et vous opposer à certains
      traitements. Contact : <em>à compléter</em>. Vous pouvez aussi saisir la CNIL.
    </p>

    <h2>9. Cookies</h2>
    <p>
      Voir la
      <NuxtLink to="/cookies">politique cookies</NuxtLink>.
    </p>

    <p class="note">Dernière mise à jour : 25 août 2026.</p>
  </article>
</template>
