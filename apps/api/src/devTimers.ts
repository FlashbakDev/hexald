import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyRequest } from "fastify";
import { env } from "./env.ts";

/** Header client (dev) : accélère chantiers + recherches à 5 s. */
export const DEV_ACCELERATE_HEADER = "x-hexald-dev-accelerate";

const store = new AsyncLocalStorage<boolean>();

export function readDevAccelerateHeader(request: FastifyRequest): boolean {
  if (!env.isDev) return false;
  const raw = request.headers[DEV_ACCELERATE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1" || value === "true";
}

export function runWithDevTimers<T>(enabled: boolean, fn: () => T): T {
  return store.run(Boolean(enabled), fn);
}

/** `true` seulement si NODE_ENV=dev et le client a envoyé le header (UI debug ON). */
export function wantDevTimers(): boolean {
  return env.isDev && store.getStore() === true;
}
