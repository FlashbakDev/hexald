/** Liens de navigation marketing (maillage SEO). */

export const SITE_NAV_LINKS = [
  { to: "/", label: "Accueil" },
  { to: "/guide", label: "Guide" },
  { to: "/news", label: "Actualités" },
  { to: "/leaderboard", label: "Classement" }
] as const;

export type SiteNavPath = (typeof SITE_NAV_LINKS)[number]["to"];
