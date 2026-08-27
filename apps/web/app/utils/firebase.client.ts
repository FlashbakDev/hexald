import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function readFirebasePublicConfig() {
  const config = useRuntimeConfig().public;
  return {
    apiKey: String(config.firebaseApiKey || "").trim(),
    authDomain: String(config.firebaseAuthDomain || "").trim(),
    projectId: String(config.firebaseProjectId || "").trim(),
    appId: String(config.firebaseAppId || "").trim()
  };
}

/** Snapshot sans secrets — pour debug console / dialog. */
export function getFirebaseConfigDebug() {
  const c = readFirebasePublicConfig();
  return {
    configured: Boolean(c.apiKey && c.authDomain && c.projectId && c.appId),
    hasApiKey: Boolean(c.apiKey),
    hasAuthDomain: Boolean(c.authDomain),
    hasProjectId: Boolean(c.projectId),
    hasAppId: Boolean(c.appId),
    authDomain: c.authDomain || "(vide)",
    projectId: c.projectId || "(vide)",
    apiKeyLen: c.apiKey.length,
    appIdLen: c.appId.length
  };
}

export function isFirebaseClientConfigured(): boolean {
  return getFirebaseConfigDebug().configured;
}

export function getFirebaseAuthClient(): Auth | null {
  if (!import.meta.client) return null;
  if (!isFirebaseClientConfigured()) return null;

  if (!auth) {
    const c = readFirebasePublicConfig();
    // Toujours *.firebaseapp.com (HTTPS). Un authDomain = IP LAN HTTP
    // provoque ERR_SSL_PROTOCOL_ERROR (Firebase force souvent https://).
    app =
      getApps()[0] ??
      initializeApp({
        apiKey: c.apiKey,
        authDomain: c.authDomain,
        projectId: c.projectId,
        appId: c.appId
      });
    auth = getAuth(app);
  }
  return auth;
}
