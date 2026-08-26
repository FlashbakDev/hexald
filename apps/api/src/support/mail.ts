import { Resend } from "resend";
import { env } from "../env.ts";

export type SupportMailPayload = {
  category: string;
  categoryLabel: string;
  message: string;
  player: {
    id: string;
    pseudo: string | null;
    kind: string;
    email: string | null;
    firebaseUid: string | null;
  };
  meta?: {
    url?: string;
    userAgent?: string;
    worldId?: string;
  };
};

function buildBody(payload: SupportMailPayload): string {
  const lines = [
    `Catégorie : ${payload.categoryLabel} (${payload.category})`,
    "",
    "— Joueur —",
    `Pseudo : ${payload.player.pseudo ?? "(aucun)"}`,
    `Email : ${payload.player.email ?? "(aucun)"}`,
    `Compte : ${payload.player.kind}`,
    `Player ID : ${payload.player.id}`,
    `Firebase UID : ${payload.player.firebaseUid ?? "(aucun)"}`,
    ""
  ];
  if (payload.meta?.worldId) lines.push(`World ID : ${payload.meta.worldId}`);
  if (payload.meta?.url) lines.push(`URL : ${payload.meta.url}`);
  if (payload.meta?.userAgent) lines.push(`UA : ${payload.meta.userAgent}`);
  lines.push("", "— Message —", payload.message.trim(), "");
  return lines.join("\n");
}

export type SendSupportMailResult =
  | { ok: true; mode: "resend" | "log" }
  | { ok: false; error: string };

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export function isSupportMailConfigured(): boolean {
  return Boolean(env.resendApiKey);
}

export async function sendSupportMail(
  payload: SupportMailPayload
): Promise<SendSupportMailResult> {
  const subject = `[Hexald] ${payload.categoryLabel} — ${payload.player.pseudo ?? payload.player.id}`;
  const text = buildBody(payload);
  const resend = getResend();

  if (!resend) {
    if (env.isDev) {
      console.info("[support-mail:dev]\n", {
        to: env.supportTo,
        from: env.supportFrom,
        subject,
        text
      });
      return { ok: true, mode: "log" };
    }
    return { ok: false, error: "mail_not_configured" };
  }

  const { data, error } = await resend.emails.send({
    from: env.supportFrom,
    to: [env.supportTo],
    subject,
    text,
    ...(payload.player.email ? { replyTo: payload.player.email } : {})
  });

  if (error) {
    console.error("[support-mail] resend failed", error);
    return { ok: false, error: "mail_send_failed" };
  }

  if (env.isDev) {
    console.info("[support-mail] sent", { id: data?.id, to: env.supportTo });
  }

  return { ok: true, mode: "resend" };
}
