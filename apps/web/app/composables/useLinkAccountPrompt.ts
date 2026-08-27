import { getFirebaseConfigDebug } from "~/utils/firebase.client";

const DISMISS_KEY = "hexald-link-account-dismissed";
const LOG_PREFIX = "[hexald:link-account]";

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

  function log(level: "info" | "warn", message: string, extra?: unknown) {
    if (!import.meta.client) return;
    const payload = {
      message,
      kind: kind.value,
      isGuest: isGuest.value,
      configured: configured.value,
      dismissed: dismissed.value,
      open: open.value,
      firebase: getFirebaseConfigDebug(),
      ...(extra && typeof extra === "object" ? extra : extra ? { extra } : {})
    };
    if (level === "warn") console.warn(LOG_PREFIX, payload);
    else console.info(LOG_PREFIX, payload);
  }

  function loadDismissed() {
    if (!import.meta.client) return;
    dismissed.value = localStorage.getItem(DISMISS_KEY) === "1";
  }

  function dismiss() {
    log("info", "dismiss");
    dismissed.value = true;
    open.value = false;
    if (import.meta.client) localStorage.setItem(DISMISS_KEY, "1");
  }

  /**
   * Ouvre toujours le dialog pour un invité.
   * Si Firebase n’est pas configuré, le dialog affiche l’erreur (plus de no-op silencieux).
   */
  function show(source = "manual") {
    log("info", `show requested (${source})`);

    if (!isGuest.value) {
      log("warn", "blocked: session is not a guest", { source });
      return;
    }

    if (!configured.value) {
      log("warn", "Firebase client incomplete — opening dialog with error state", {
        source
      });
    }

    open.value = true;
    log("info", "dialog open=true", { source });
  }

  /** Première invitation auto (si pas encore skip). */
  function maybeAutoShow(delayMs = 1800) {
    loadDismissed();
    log("info", "maybeAutoShow", { delayMs, canPrompt: canPrompt.value });
    if (!canPrompt.value) {
      log("warn", "auto-show skipped", {
        reason: !configured.value
          ? "firebase_not_configured"
          : !isGuest.value
            ? "not_guest"
            : dismissed.value
              ? "dismissed"
              : "unknown"
      });
      return;
    }
    window.setTimeout(() => {
      if (canPrompt.value) {
        open.value = true;
        log("info", "auto-show opened dialog");
      } else {
        log("warn", "auto-show aborted after delay");
      }
    }, delayMs);
  }

  function close() {
    log("info", "close");
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
