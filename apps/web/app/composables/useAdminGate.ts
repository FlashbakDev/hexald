export type AdminGate = "loading" | "login" | "forbidden" | "ready";

/**
 * Gate Firebase + isAdmin partagée par /admin et /admin/content.
 */
export function useAdminGate(options?: {
  onReady?: () => void;
  onLeaveReady?: () => void;
}) {
  const { kind, email, probeSession } = useSession();
  const {
    configured: firebaseConfigured,
    authBusy,
    authError,
    ensureHexaldSession,
    signInWithGoogle,
    signInWithEmail,
    watchAuth
  } = useFirebaseAuth();

  const gate = ref<AdminGate>("loading");
  const gateMessage = ref<string | null>(null);

  const emailPanelOpen = ref(false);
  const emailDraft = ref("");
  const passwordDraft = ref("");

  function leaveReady() {
    options?.onLeaveReady?.();
  }

  async function resolveGate() {
    gateMessage.value = null;
    if (gate.value === "ready") leaveReady();
    gate.value = "loading";

    if (!firebaseConfigured.value) {
      gate.value = "forbidden";
      gateMessage.value =
        "Firebase n’est pas configuré côté client. Ajoute NUXT_PUBLIC_FIREBASE_* dans apps/web/.env.";
      return;
    }

    watchAuth();
    await ensureHexaldSession();

    const session = await probeSession();
    if (!session || session.kind !== "firebase") {
      gate.value = "login";
      return;
    }

    if (!session.isAdmin) {
      gate.value = "forbidden";
      gateMessage.value =
        "Ce compte n’a pas accès admin. Demande l’ajout de ton email dans ADMIN_EMAILS (API).";
      return;
    }

    gate.value = "ready";
    options?.onReady?.();
  }

  async function onGoogleLogin() {
    const session = await signInWithGoogle();
    if (session?.isAdmin) {
      await resolveGate();
    } else if (session && !session.isAdmin) {
      gate.value = "forbidden";
      gateMessage.value = "Compte connecté, mais pas autorisé admin.";
    }
  }

  async function onEmailSubmit() {
    const addr = emailDraft.value.trim();
    const password = passwordDraft.value;
    if (!addr || password.length < 6) return;
    const session = await signInWithEmail(addr, password);
    if (session?.isAdmin) {
      await resolveGate();
    } else if (session && !session.isAdmin) {
      gate.value = "forbidden";
      gateMessage.value = "Compte connecté, mais pas autorisé admin.";
    }
  }

  onMounted(() => {
    void resolveGate();
  });

  onBeforeUnmount(() => {
    leaveReady();
  });

  return {
    gate,
    gateMessage,
    kind,
    email,
    authBusy,
    authError,
    emailPanelOpen,
    emailDraft,
    passwordDraft,
    resolveGate,
    onGoogleLogin,
    onEmailSubmit
  };
}
