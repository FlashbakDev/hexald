/**
 * Firebase Auth → cookie Hexald, puis /play si le compte a un pseudo.
 * Couvre le redirect Google et le cas « user Firebase déjà là, cookie absent ».
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

  if (session.pseudo && (bridged || route.path === "/")) {
    await navigateTo("/play", { replace: true });
    return;
  }

  if (!session.pseudo && bridged && route.path !== "/") {
    authError.value = null;
    await navigateTo("/", { replace: true });
  }
});
