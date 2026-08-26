/** Statut réseau — Hexald n’a pas de mode jeu offline. */
export function useNetworkStatus() {
  const online = useState("hx-online", () => true);

  if (import.meta.client) {
    const onOnline = () => {
      online.value = true;
    };
    const onOffline = () => {
      online.value = false;
    };

    onMounted(() => {
      online.value = navigator.onLine;
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    });

    onUnmounted(() => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    });
  }

  return online;
}
