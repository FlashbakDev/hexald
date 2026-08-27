import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE } from "~/utils/seo";

/** URL absolue site (sans slash final). */
export function useSiteAbsoluteUrl() {
  const config = useRuntimeConfig();
  return String(config.public.siteUrl || "https://hexald.com").replace(
    /\/$/,
    ""
  );
}

export function absoluteUrl(siteUrl: string, path: string) {
  if (path.startsWith("http")) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export type BreadcrumbCrumb = { name: string; item: string };

/**
 * BreadcrumbList Schema.org (item = path relatif ou absolu).
 */
export function useBreadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  const siteUrl = useSiteAbsoluteUrl();
  useSchemaOrg([
    defineBreadcrumb({
      itemListElement: crumbs.map((crumb) => ({
        name: crumb.name,
        item: absoluteUrl(siteUrl, crumb.item)
      }))
    })
  ]);
}

/**
 * VideoGame + SoftwareApplication sur la landing.
 */
export function useLandingGameSchema() {
  const siteUrl = useSiteAbsoluteUrl();
  useSchemaOrg([
    defineWebPage({
      name: `${SITE_NAME} — jeu de stratégie hexagonale`,
      description: SITE_DESCRIPTION
    }),
    {
      "@type": ["VideoGame", "SoftwareApplication"],
      "@id": `${siteUrl}/#game`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: siteUrl,
      image: absoluteUrl(siteUrl, SITE_OG_IMAGE),
      inLanguage: "fr",
      genre: ["Strategy", "Management", "4X"],
      gamePlatform: ["Web browser"],
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock"
      },
      author: { "@id": `${siteUrl}/#identity` },
      publisher: { "@id": `${siteUrl}/#identity` }
    }
  ]);
}

export type NewsSchemaPost = {
  slug: string;
  kind: "patchnote" | "blog";
  title: string;
  date: string;
  summary: string;
};

/**
 * NewsArticle / BlogPosting + fil d’Ariane pour un article.
 */
export function useNewsArticleSchema(post: NewsSchemaPost) {
  const siteUrl = useSiteAbsoluteUrl();
  const path = `/news/${post.slug}`;
  const articleType = post.kind === "blog" ? "BlogPosting" : "NewsArticle";

  useSchemaOrg([
    defineArticle({
      "@type": articleType,
      headline: post.title,
      description: post.summary,
      datePublished: post.date,
      dateModified: post.date,
      image: absoluteUrl(siteUrl, SITE_OG_IMAGE),
      inLanguage: "fr",
      author: {
        name: SITE_NAME,
        url: siteUrl
      },
      publisher: {
        name: SITE_NAME,
        logo: absoluteUrl(siteUrl, "/icon.png")
      },
      mainEntityOfPage: absoluteUrl(siteUrl, path)
    }),
    defineBreadcrumb({
      itemListElement: [
        { name: "Accueil", item: absoluteUrl(siteUrl, "/") },
        { name: "Actualités", item: absoluteUrl(siteUrl, "/news") },
        { name: post.title, item: absoluteUrl(siteUrl, path) }
      ]
    })
  ]);
}
