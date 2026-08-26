import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Charge apps/api/.env si présent (tsx/node ne le font pas seuls). */
function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Toujours reprendre FIREBASE_* depuis le fichier (évite un --env-file
    // Node qui laisse une clé PEM invalide déjà injectée).
    if (process.env[key] !== undefined && !key.startsWith("FIREBASE_")) continue;
    process.env[key] = value;
  }
}

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnvFile(resolve(apiRoot, ".env"));

function argValue(name: string): string | true | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));

  if (index === -1) {
    return undefined;
  }

  const current = args[index];
  if (current.startsWith(`${name}=`)) {
    return current.slice(name.length + 1) || true;
  }

  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    return true;
  }

  return next;
}

const hostFlag = argValue("--host");
const portFlag = argValue("--port");

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hexald:hexald@127.0.0.1:5432/hexald";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sessionSecret =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV !== "production"
    ? "dev-only-session-secret-change-me-32b"
    : undefined);

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET is required (min 32 characters)");
}

const isDev = process.env.NODE_ENV !== "production";

function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  // .env peut contenir \n, \\n, \\\\n… → une seule passe sur \+n
  key = key.replace(/\\+n/g, "\n").replace(/\r/g, "").trim();
  // Résidu d’échappement : backslash avant un vrai saut de ligne
  key = key.replace(/\\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY") || !key.includes("END PRIVATE KEY")) {
    return undefined;
  }
  return key;
}

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim() || undefined;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || undefined;
const firebasePrivateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

const firebaseConfigured = Boolean(
  firebaseProjectId && firebaseClientEmail && firebasePrivateKey
);

export const env = {
  host:
    hostFlag === true
      ? "0.0.0.0"
      : hostFlag || process.env.HOST || "127.0.0.1",
  port: Number(portFlag || process.env.PORT || 9088),
  isDev,
  databaseUrl,
  sessionSecret,
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    "http://127.0.0.1:9089,http://localhost:9089"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  firebase: firebaseConfigured
    ? {
        projectId: firebaseProjectId!,
        clientEmail: firebaseClientEmail!,
        privateKey: firebasePrivateKey!
      }
    : null,
  /** Resend — si absent : log en dev, 503 en prod. */
  resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
  supportTo: process.env.SUPPORT_TO?.trim() || "contact@hexald.com",
  supportFrom:
    process.env.SUPPORT_FROM?.trim() || "Hexald <noreply@hexald.com>",
  /** Emails autorisés pour /v1/admin/* (minuscules, séparés par des virgules). */
  adminEmails: new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )
};
