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

export function isFirebaseClientConfigured(): boolean {
  const c = readFirebasePublicConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
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
