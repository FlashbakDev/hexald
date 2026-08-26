import type { FastifyInstance } from "fastify";
import { biomes, buildings, chains, resources } from "@hexald/content";
import { fetchAdminDbStats, fetchPlayersByIds } from "@hexald/db";
import {
  listOnlinePresence,
  PRESENCE_TTL_MS
} from "../presence.ts";
import { env } from "../env.ts";
import {
  isSupportMailConfigured,
  sendSupportMail
} from "../support/mail.ts";

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
      supportMail: {
        isDev: env.isDev,
        configured: isSupportMailConfigured(),
        to: env.supportTo,
        from: env.supportFrom
      },
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

  /** Dev only — envoie un mail de test via Resend (ou log si pas de clé). */
  app.post("/admin/test-mail", async (_request, reply) => {
    if (!env.isDev) {
      return reply.code(403).send({ error: "dev_only" });
    }

    const result = await sendSupportMail({
      category: "support",
      categoryLabel: "Test admin",
      message:
        "Mail de test envoyé depuis /admin (environnement development).\nSi tu lis ceci, Resend fonctionne.",
      player: {
        id: "00000000-0000-4000-8000-000000000000",
        pseudo: "admin-test",
        kind: "admin",
        email: null,
        firebaseUid: null
      },
      meta: {
        url: "admin://test-mail",
        userAgent: "hexald-admin"
      }
    });

    if (!result.ok) {
      const status = result.error === "mail_not_configured" ? 503 : 502;
      return reply.code(status).send({
        error: result.error,
        to: env.supportTo,
        from: env.supportFrom
      });
    }

    return {
      ok: true as const,
      mode: result.mode,
      to: env.supportTo,
      from: env.supportFrom
    };
  });
}
