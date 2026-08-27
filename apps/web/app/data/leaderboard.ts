import type { LeaderboardEntrySnapshot, LeaderboardSnapshot } from "@hexald/shared";

export type LeaderboardEntry = LeaderboardEntrySnapshot;

export const LEADERBOARD_SCORE_LABEL = "PC";
export const LEADERBOARD_PAGE_SIZE = 20;

export async function fetchLeaderboard(options?: {
  page?: number;
  pageSize?: number;
}): Promise<LeaderboardSnapshot> {
  const config = useRuntimeConfig();
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = Math.max(
    1,
    Math.floor(options?.pageSize ?? LEADERBOARD_PAGE_SIZE)
  );
  return $fetch<LeaderboardSnapshot>("/v1/leaderboard", {
    baseURL: config.public.apiBase,
    credentials: "include",
    query: { page, pageSize }
  });
}
