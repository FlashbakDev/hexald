export const SUPPORT_CATEGORIES = [
  "bug",
  "suggestion",
  "support"
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 4000;

export type SupportReportRequest = {
  category: SupportCategory;
  message: string;
  /** Optionnel — contexte client (UA, URL, worldId…). */
  meta?: {
    url?: string;
    userAgent?: string;
    worldId?: string;
  };
};

export type SupportReportResult = {
  ok: true;
};

export function isSupportCategory(value: unknown): value is SupportCategory {
  return (
    typeof value === "string" &&
    (SUPPORT_CATEGORIES as readonly string[]).includes(value)
  );
}
