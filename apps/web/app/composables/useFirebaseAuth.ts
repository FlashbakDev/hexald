import type { FirebaseSessionResult, SessionSnapshot } from "@hexald/shared";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from "firebase/auth";
import {
  getFirebaseAuthClient,
  isFirebaseClientConfigured
} from "~/utils/firebase.client";

const REDIRECT_FLAG = "hexald-firebase-google-redirect";

function googleSetupHint(): string {
  if (!import.meta.client) return "";
  const host = window.location.hostname;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return ` Ajoute « ${host} » dans Firebase → Authentication → Settings → Authorized domains. Ouvre le site en http:// (pas https://).`;
  }
  return "";
}


export function useFirebaseAuth() {
  const config = useRuntimeConfig();
  const { applySession } = useSession();

  const firebaseUser = useState<User | null>("firebase-user", () => null);
  const firebaseReady = useState("firebase-ready", () => false);
  const authError = useState<string | null>("firebase-auth-error", () => null);
  const authBusy = useState("firebase-auth-busy", () => false);

  const configured = computed(() => isFirebaseClientConfigured());

  function mapFirebaseError(code: string | undefined): string {
    switch (code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Connexion annulée.";
      case "auth/popup-blocked":
        return "Popup bloquée — autorise les popups pour Hexald, ou réessaie.";
      case "auth/email-already-in-use":
        return "Cet email est déjà utilisé.";
      case "auth/invalid-email":
        return "Email invalide.";
      case "auth/weak-password":
        return "Mot de passe trop faible (6 caractères min.).";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email ou mot de passe incorrect. Si le compte est Google, utilise le bouton Google.";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessaie plus tard.";
      case "auth/unauthorized-domain": {
        const host =
          typeof window !== "undefined" ? window.location.hostname : "";
        return host
          ? `Domaine non autorisé : ajoute « ${host} » dans Firebase (Authentication → Settings → Authorized domains).`
          : "Domaine non autorisé dans Firebase (ajoute ton IP LAN / localhost).";
      }
      case "auth/redirect-cancelled-by-user":
        return "Connexion annulée.";
      case "auth/redirect-operation-pending":
        return "Une connexion Google est déjà en cours…";
      case "auth/operation-not-supported-in-this-environment":
        return "Connexion Google impossible dans cet environnement." + googleSetupHint();
      case "google_redirect_lost":
        return (
          "Connexion Google interrompue sur mobile." + googleSetupHint()
        );
      case "firebase_not_configured":
        return "Firebase n’est pas configuré.";
      case "invalid_token":
        return "Session Firebase invalide.";
      case "firebase_not_configured_server":
        return "Firebase Admin n’est pas configuré côté serveur.";
      case "session_failed":
        return "Session impossible après connexion.";
      default:
        return "Connexion impossible.";
    }
  }

  async function exchangeIdToken(idToken: string): Promise<FirebaseSessionResult> {
    return await $fetch<FirebaseSessionResult>("/v1/session/firebase", {
      baseURL: config.public.apiBase,
      method: "POST",
      credentials: "include",
      body: { idToken }
    });
  }

  async function syncSessionFromUser(user: User): Promise<SessionSnapshot> {
    firebaseUser.value = user;
    const idToken = await user.getIdToken();
    try {
      const session = await exchangeIdToken(idToken);
      applySession(session);
      return session;
    } catch (err) {
      const apiCode =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { error?: string } }).data?.error
          : undefined;
      const code =
        apiCode === "firebase_not_configured"
          ? "firebase_not_configured_server"
          : (apiCode ?? "session_failed");
      throw Object.assign(new Error(code), { code });
    }
  }

  function readErrorCode(err: unknown): string | undefined {
    if (!err || typeof err !== "object") return undefined;
    if ("code" in err) return String((err as { code: string }).code);
    if ("data" in err) {
      return (err as { data?: { error?: string } }).data?.error;
    }
    return undefined;
  }

  function watchAuth() {
    if (!import.meta.client) return;
    const auth = getFirebaseAuthClient();
    if (!auth) {
      firebaseReady.value = true;
      return;
    }
    onAuthStateChanged(auth, (user) => {
      firebaseUser.value = user;
      firebaseReady.value = true;
    });
  }

  /**
   * Après redirect Google : échange le token.
   * Si `getRedirectResult` est vide (cas fréquent), retombe sur `currentUser`
   * quand un redirect était en cours.
   */
  async function consumeGoogleRedirect(): Promise<SessionSnapshot | null> {
    if (!import.meta.client) return null;
    const auth = getFirebaseAuthClient();
    if (!auth) return null;

    const pending = sessionStorage.getItem(REDIRECT_FLAG) === "1";
    try {
      const result = await getRedirectResult(auth);
      let user = result?.user ?? null;

      if (!user && pending) {
        await auth.authStateReady();
        user = auth.currentUser;
      }

      if (!user) {
        if (pending) {
          sessionStorage.removeItem(REDIRECT_FLAG);
          authError.value = mapFirebaseError("google_redirect_lost");
        }
        return null;
      }

      sessionStorage.removeItem(REDIRECT_FLAG);
      return await syncSessionFromUser(user);
    } catch (err) {
      if (pending) {
        try {
          await auth.authStateReady();
          if (auth.currentUser) {
            sessionStorage.removeItem(REDIRECT_FLAG);
            return await syncSessionFromUser(auth.currentUser);
          }
        } catch {
          /* ignore secondary sync failure */
        }
        authError.value = mapFirebaseError(readErrorCode(err));
      }
      sessionStorage.removeItem(REDIRECT_FLAG);
      return null;
    }
  }

  /**
   * Aligne Firebase Auth → cookie Hexald.
   * - Traite un redirect Google s’il y en a un
   * - Sinon, si Firebase a un user mais pas de session Hexald (ou guest),
   *   échange l’idToken via POST /v1/session/firebase
   */
  async function ensureHexaldSession(): Promise<{
    session: SessionSnapshot | null;
    bridged: boolean;
  }> {
    const fromRedirect = await consumeGoogleRedirect();
    if (fromRedirect) return { session: fromRedirect, bridged: true };

    const auth = getFirebaseAuthClient();
    if (!auth) return { session: null, bridged: false };

    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return { session: null, bridged: false };

    const { probeSession, hasAccount, kind, playerId, pseudo, email, isAdmin } =
      useSession();

    let existing: SessionSnapshot | null = null;
    if (hasAccount.value && playerId.value) {
      existing = {
        playerId: playerId.value,
        pseudo: pseudo.value,
        kind: kind.value,
        email: email.value,
        isAdmin: isAdmin.value
      };
    } else {
      existing = await probeSession();
    }

    // Session Hexald déjà liée à Firebase — rien à faire.
    if (existing?.kind === "firebase") {
      return { session: existing, bridged: false };
    }

    try {
      const session = await syncSessionFromUser(user);
      return { session, bridged: true };
    } catch (err) {
      authError.value = mapFirebaseError(readErrorCode(err));
      return { session: null, bridged: false };
    }
  }

  async function startGoogleRedirect(
    auth: NonNullable<ReturnType<typeof getFirebaseAuthClient>>
  ) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    sessionStorage.setItem(REDIRECT_FLAG, "1");
    await signInWithRedirect(auth, provider);
  }

  async function signInWithGoogle(): Promise<SessionSnapshot | null> {
    const auth = getFirebaseAuthClient();
    if (!auth) {
      authError.value = mapFirebaseError("firebase_not_configured");
      return null;
    }
    authBusy.value = true;
    authError.value = null;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // Popup partout en premier (COOP retiré). Sur mobile, le redirect
      // historique cassait avec *.firebaseapp.com (cookies tiers).
      const result = await signInWithPopup(auth, provider);
      return await syncSessionFromUser(result.user);
    } catch (err) {
      const code = readErrorCode(err);
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        authError.value = mapFirebaseError(code);
        return null;
      }
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await startGoogleRedirect(auth);
          return null;
        } catch (redirectErr) {
          sessionStorage.removeItem(REDIRECT_FLAG);
          authError.value = mapFirebaseError(readErrorCode(redirectErr));
          return null;
        }
      }
      sessionStorage.removeItem(REDIRECT_FLAG);
      authError.value = mapFirebaseError(code);
      return null;
    } finally {
      authBusy.value = false;
    }
  }

  async function signInWithEmail(
    email: string,
    password: string
  ): Promise<SessionSnapshot | null> {
    const auth = getFirebaseAuthClient();
    if (!auth) {
      authError.value = mapFirebaseError("firebase_not_configured");
      return null;
    }
    authBusy.value = true;
    authError.value = null;
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return await syncSessionFromUser(result.user);
    } catch (err) {
      authError.value = mapFirebaseError(readErrorCode(err));
      return null;
    } finally {
      authBusy.value = false;
    }
  }

  async function registerWithEmail(
    email: string,
    password: string
  ): Promise<SessionSnapshot | null> {
    const auth = getFirebaseAuthClient();
    if (!auth) {
      authError.value = mapFirebaseError("firebase_not_configured");
      return null;
    }
    authBusy.value = true;
    authError.value = null;
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return await syncSessionFromUser(result.user);
    } catch (err) {
      authError.value = mapFirebaseError(readErrorCode(err));
      return null;
    } finally {
      authBusy.value = false;
    }
  }

  async function logoutFirebase(): Promise<void> {
    const { clearSessionCookie } = useSession();
    const auth = getFirebaseAuthClient();
    if (auth) await signOut(auth);
    firebaseUser.value = null;
    await clearSessionCookie();
  }

  return {
    configured,
    firebaseUser,
    firebaseReady,
    authError,
    authBusy,
    watchAuth,
    consumeGoogleRedirect,
    ensureHexaldSession,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    logoutFirebase,
    syncSessionFromUser,
    mapFirebaseError
  };
}
