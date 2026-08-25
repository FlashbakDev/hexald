import type { SessionSnapshot } from "@hexald/shared";

export function useSession() {
  const config = useRuntimeConfig();
  const playerId = useState<string | null>("session-player-id", () => null);
  const pseudo = useState<string | null>("session-pseudo", () => null);
  const ready = useState("session-ready", () => false);
  const error = useState<string | null>("session-error", () => null);

  function applySession(session: SessionSnapshot) {
    playerId.value = session.playerId;
    pseudo.value = session.pseudo;
    error.value = null;
    ready.value = true;
  }

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
      playerId.value = null;
      pseudo.value = null;
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

  return {
    playerId,
    pseudo,
    ready,
    error,
    ensureSession,
    claimPseudo
  };
}
