const ONLINE_TTL_MS = 5 * 60 * 1000;

type PresenceEntry = {
  playerId: string;
  lastSeenAt: number;
};

const presence = new Map<string, PresenceEntry>();

function prune(now = Date.now()) {
  for (const [id, entry] of presence) {
    if (now - entry.lastSeenAt > ONLINE_TTL_MS) {
      presence.delete(id);
    }
  }
}

export function touchPresence(playerId: string) {
  presence.set(playerId, { playerId, lastSeenAt: Date.now() });
}

export function listOnlinePresence(): PresenceEntry[] {
  const now = Date.now();
  prune(now);
  return [...presence.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function onlineCount(): number {
  prune();
  return presence.size;
}

export const PRESENCE_TTL_MS = ONLINE_TTL_MS;
