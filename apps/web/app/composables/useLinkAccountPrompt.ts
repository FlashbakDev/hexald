const DISMISS_KEY = "hexald-link-account-dismissed";

/** Popup « lier le compte » pour les guests en jeu. */
export function useLinkAccountPrompt() {
  const { kind } = useSession();
  const { configured } = useFirebaseAuth();

  const open = useState("link-account-open", () => false);
  const dismissed = useState("link-account-dismissed", () => false);

  const isGuest = computed(() => kind.value !== "firebase");
  const canPrompt = computed(
    () => configured.value && isGuest.value && !dismissed.value
  );

  function loadDismissed() {
    if (!import.meta.client) return;
    dismissed.value = localStorage.getItem(DISMISS_KEY) === "1";
  }

  function dismiss() {
    dismissed.value = true;
    open.value = false;
    if (import.meta.client) localStorage.setItem(DISMISS_KEY, "1");
  }

  function show() {
    if (!configured.value || !isGuest.value) return;
    open.value = true;
  }

  /** Première invitation auto (si pas encore skip). */
  function maybeAutoShow(delayMs = 1800) {
    loadDismissed();
    if (!canPrompt.value) return;
    window.setTimeout(() => {
      if (canPrompt.value) open.value = true;
    }, delayMs);
  }

  function close() {
    open.value = false;
  }

  return {
    open,
    dismissed,
    isGuest,
    canPrompt,
    loadDismissed,
    dismiss,
    show,
    maybeAutoShow,
    close
  };
}
