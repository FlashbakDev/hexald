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
    .filter(Boolean)
};
