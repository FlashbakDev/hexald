const DEBUG_CHROME_STORAGE_KEY = "hexald-debug-chrome-visible";

/**
 * Mode debug UI (dev uniquement) : panneau chrome + accélération timers (5 s).
 * Partagé play / useWorld via useState.
 */
export function useDebugMode() {
  const isDevClient = import.meta.dev;
  const debugChromeVisible = useState("hexald-debug-chrome-visible", () => true);

  const accelerateTimers = computed(
    () => isDevClient && debugChromeVisible.value
  );

  function toggleDebugChrome() {
    if (!isDevClient) return;
    debugChromeVisible.value = !debugChromeVisible.value;
  }

  if (import.meta.client && isDevClient) {
    onMounted(() => {
      try {
        const saved = localStorage.getItem(DEBUG_CHROME_STORAGE_KEY);
        if (saved === "0") debugChromeVisible.value = false;
      } catch {
        /* ignore */
      }
    });
    watch(debugChromeVisible, (visible) => {
      try {
        localStorage.setItem(DEBUG_CHROME_STORAGE_KEY, visible ? "1" : "0");
      } catch {
        /* ignore */
      }
    });
  }

  return {
    isDevClient,
    debugChromeVisible,
    accelerateTimers,
    toggleDebugChrome
  };
}
