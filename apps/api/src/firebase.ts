import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env } from "./env.ts";

let app: App | null = null;
let auth: Auth | null = null;
let initError: string | null = null;

export function isFirebaseAdminReady(): boolean {
  return env.firebase != null && initError == null && tryInit();
}

function tryInit(): boolean {
  if (!env.firebase) return false;
  if (auth) return true;
  if (initError) return false;
  try {
    app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey
        })
      });
    auth = getAuth(app);
    return true;
  } catch (err) {
    initError = err instanceof Error ? err.message : "firebase_init_failed";
    return false;
  }
}

export function getFirebaseAdminInitError(): string | null {
  tryInit();
  return initError;
}

export function getFirebaseAuth(): Auth {
  if (!env.firebase) {
    throw new Error("firebase_not_configured");
  }
  if (!tryInit() || !auth) {
    throw new Error(initError ?? "firebase_not_configured");
  }
  return auth;
}

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || typeof idToken !== "string") return null;
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null
    };
  } catch (err) {
    if (env.isDev) {
      console.warn(
        "[firebase] verifyIdToken failed:",
        err instanceof Error ? err.message : err
      );
    }
    return null;
  }
}
