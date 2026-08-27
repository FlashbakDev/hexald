/**
 * Firebase Auth → cookie Hexald (bridge).
 * Pas de redirection auto vers /play : l’utilisateur choisit via la landing.
 */
export default defineNuxtPlugin(async () => {
  if (!import.meta.client) return;

  const { watchAuth, configured, ensureHexaldSession, authError } =
    useFirebaseAuth();

  if (!configured.value) return;

  watchAuth();

  const route = useRoute();
  const { session, bridged } = await ensureHexaldSession();
  if (!session) return;

  // Compte cloud sans pseudo : ramener sur la landing pour choisir / claim.
  if (!session.pseudo && bridged && route.path !== "/") {
    authError.value = null;
    await navigateTo("/", { replace: true });
  }
});
