import type { FastifyInstance } from "fastify";
import { biomes, buildings, chains, resources } from "@hexald/content";
import { fetchAdminDbStats, fetchPlayersByIds } from "@hexald/db";
import {
  listOnlinePresence,
  PRESENCE_TTL_MS
} from "../presence.ts";

function toIso(value: Date) {
  return value.toISOString();
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async () => {
    const stats = await fetchAdminDbStats(app.db);
    const online = listOnlinePresence();
    const onlinePlayers = await fetchPlayersByIds(
      app.db,
      online.map((entry) => entry.playerId)
    );
    const byId = new Map(onlinePlayers.map((player) => [player.id, player]));

    const onlineNamed = online.flatMap((entry) => {
      const player = byId.get(entry.playerId);
      if (!player?.pseudo) return [];
      return [
        {
          playerId: entry.playerId,
          pseudo: player.pseudo,
          kind: player.kind,
          lastSeenAt: new Date(entry.lastSeenAt).toISOString()
        }
      ];
    });

    return {
      generatedAt: new Date().toISOString(),
      presenceTtlMs: PRESENCE_TTL_MS,
      counts: {
        playersTotal: stats.playersTotal,
        playersNamed: stats.playersNamed,
        worldsTotal: stats.worldsTotal,
        online: onlineNamed.length,
        content: {
          biomes: biomes.length,
          resources: resources.length,
          buildings: buildings.length,
          chains: chains.length
        }
      },
      online: onlineNamed,
      recentPlayers: stats.recentPlayers.map((player) => ({
        id: player.id,
        kind: player.kind,
        pseudo: player.pseudo,
        createdAt: toIso(player.createdAt)
      })),
      recentWorlds: stats.recentWorlds.map((world) => ({
        id: world.id,
        ownerId: world.ownerId,
        ownerPseudo: world.ownerPseudo,
        createdAt: toIso(world.createdAt),
        updatedAt: toIso(world.updatedAt)
      }))
    };
  });
}
