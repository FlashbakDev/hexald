import type { SessionSnapshot } from "@hexald/shared";

export function useSession() {
  const config = useRuntimeConfig();
  const playerId = useState<string | null>("session-player-id", () => null);
  const pseudo = useState<string | null>("session-pseudo", () => null);
  const kind = useState<string>("session-kind", () => "anonymous");
  const email = useState<string | null>("session-email", () => null);
  const avatarId = useState<string | null>("session-avatar-id", () => null);
  const isAdmin = useState("session-is-admin", () => false);
  /** Cookie / compte déjà présent (GET), sans en créer un. */
  const hasAccount = useState("session-has-account", () => false);
  const ready = useState("session-ready", () => false);
  const error = useState<string | null>("session-error", () => null);

  function applySession(session: SessionSnapshot) {
    playerId.value = session.playerId;
    pseudo.value = session.pseudo;
    kind.value = session.kind ?? "anonymous";
    email.value = session.email ?? null;
    avatarId.value = session.avatarId ?? null;
    isAdmin.value = session.isAdmin ?? false;
    hasAccount.value = true;
    error.value = null;
    ready.value = true;
  }

  function clearLocalSession() {
    playerId.value = null;
    pseudo.value = null;
    kind.value = "anonymous";
    email.value = null;
    avatarId.value = null;
    isAdmin.value = false;
    hasAccount.value = false;
  }

  /** Lit la session existante sans créer de guest. */
  async function probeSession(): Promise<SessionSnapshot | null> {
    try {
      const session = await $fetch<SessionSnapshot>("/v1/session", {
        baseURL: config.public.apiBase,
        method: "GET",
        credentials: "include"
      });
      applySession(session);
      return session;
    } catch {
      clearLocalSession();
      error.value = null;
      ready.value = true;
      return null;
    }
  }

  /** Crée un guest si besoin (cookie). */
  async function ensureSession(): Promise<SessionSnapshot | null> {
    try {
      const session = await $fetch<SessionSnapshot>("/v1/session", {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include"
      });
      applySession(session);
      return session;
    } catch (err) {
      clearLocalSession();
      error.value = err instanceof Error ? err.message : "session_failed";
      ready.value = true;
      return null;
    }
  }

  async function claimPseudo(nextPseudo: string): Promise<SessionSnapshot> {
    const session = await $fetch<SessionSnapshot>("/v1/session/pseudo", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include",
      body: { pseudo: nextPseudo }
    });
    applySession(session);
    return session;
  }

  async function setAvatar(nextAvatarId: string): Promise<SessionSnapshot> {
    const session = await $fetch<SessionSnapshot>("/v1/session/avatar", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include",
      body: { avatarId: nextAvatarId }
    });
    applySession(session);
    return session;
  }

  async function renamePseudo(nextPseudo: string): Promise<SessionSnapshot> {
    const session = await $fetch<SessionSnapshot>("/v1/session/pseudo/rename", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include",
      body: { pseudo: nextPseudo }
    });
    applySession(session);
    return session;
  }

  async function checkPseudoAvailable(nextPseudo: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    return await $fetch<{ available: boolean; reason?: string }>(
      "/v1/session/pseudo/available",
      {
        baseURL: config.public.apiBase,
        method: "GET",
        credentials: "include",
        query: { pseudo: nextPseudo }
      }
    );
  }

  async function clearSessionCookie(): Promise<void> {
    try {
      await $fetch("/v1/session", {
        baseURL: config.public.apiBase,
        method: "DELETE",
        credentials: "include"
      });
    } catch {
      // ignore
    }
    clearLocalSession();
  }

  return {
    playerId,
    pseudo,
    kind,
    email,
    avatarId,
    isAdmin,
    hasAccount,
    ready,
    error,
    applySession,
    probeSession,
    ensureSession,
    claimPseudo,
    setAvatar,
    renamePseudo,
    checkPseudoAvailable,
    clearSessionCookie
  };
}
