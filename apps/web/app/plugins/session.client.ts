export default defineNuxtPlugin(async () => {
  if (import.meta.server) return;

  const { ensureSession } = useSession();
  await ensureSession();
});
