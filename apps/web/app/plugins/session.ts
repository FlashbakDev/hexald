/**
 * Sonde la session sur serveur et client pour aligner le HTML SSR
 * (évite les mismatches d’hydratation sur le CTA landing).
 */
export default defineNuxtPlugin(async () => {
  const { probeSession } = useSession();
  await probeSession();
});
