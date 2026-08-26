import type { FastifyInstance } from "fastify";
import {
  isSupportCategory,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  type SupportCategory,
  type SupportReportResult
} from "@hexald/shared";
import { requirePlayer } from "../session/player.ts";
import { sendSupportMail } from "../support/mail.ts";

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  support: "Support"
};

/** Anti-spam simple en mémoire (par process). */
const lastSentAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;

function readMeta(raw: unknown): {
  url?: string;
  userAgent?: string;
  worldId?: string;
} {
  if (!raw || typeof raw !== "object") return {};
  const meta = raw as Record<string, unknown>;
  const out: { url?: string; userAgent?: string; worldId?: string } = {};
  if (typeof meta.url === "string" && meta.url.length <= 500) {
    out.url = meta.url;
  }
  if (typeof meta.userAgent === "string" && meta.userAgent.length <= 400) {
    out.userAgent = meta.userAgent;
  }
  if (typeof meta.worldId === "string" && meta.worldId.length <= 80) {
    out.worldId = meta.worldId;
  }
  return out;
}

export async function supportRoutes(app: FastifyInstance) {
  app.post("/support", async (request, reply) => {
    const player = await requirePlayer(app, request, reply);
    if (!player) return;

    const body = request.body as Record<string, unknown> | null;
    const category = body?.category;
    const messageRaw = body?.message;

    if (!isSupportCategory(category)) {
      return reply.code(400).send({ error: "invalid_category" });
    }
    if (typeof messageRaw !== "string") {
      return reply.code(400).send({ error: "invalid_message" });
    }

    const message = messageRaw.trim();
    if (
      message.length < SUPPORT_MESSAGE_MIN ||
      message.length > SUPPORT_MESSAGE_MAX
    ) {
      return reply.code(400).send({ error: "invalid_message_length" });
    }

    const now = Date.now();
    const last = lastSentAt.get(player.id) ?? 0;
    if (now - last < COOLDOWN_MS) {
      return reply.code(429).send({ error: "rate_limited" });
    }

    const result = await sendSupportMail({
      category,
      categoryLabel: CATEGORY_LABELS[category],
      message,
      player: {
        id: player.id,
        pseudo: player.pseudo,
        kind: player.kind,
        email: player.email,
        firebaseUid: player.firebaseUid
      },
      meta: readMeta(body?.meta)
    });

    if (!result.ok) {
      const status = result.error === "mail_not_configured" ? 503 : 502;
      return reply.code(status).send({ error: result.error });
    }

    lastSentAt.set(player.id, now);
    return { ok: true } satisfies SupportReportResult;
  });
}
