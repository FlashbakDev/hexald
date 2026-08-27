import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE
} from "~/utils/seo";

export type PageSeoInput = {
  title: string;
  description?: string;
  /** Absolute path on site, e.g. `/news/foo`. Defaults to current route. */
  path?: string;
  ogImage?: string;
  /** Indexable by default; set false for app / admin pages. */
  indexable?: boolean;
};

/**
 * Meta SEO cohérentes (title, description, OG, Twitter, canonical via module).
 */
export function usePageSeo(input: PageSeoInput | (() => PageSeoInput)) {
  const route = useRoute();
  const config = useRuntimeConfig();
  const siteUrl = String(config.public.siteUrl || "https://hexald.com").replace(
    /\/$/,
    ""
  );

  const resolved = computed(() =>
    typeof input === "function" ? input() : input
  );

  useSeoMeta({
    title: () => resolved.value.title,
    description: () => resolved.value.description ?? SITE_DESCRIPTION,
    ogTitle: () => resolved.value.title,
    ogDescription: () => resolved.value.description ?? SITE_DESCRIPTION,
    ogType: "website",
    ogSiteName: SITE_NAME,
    ogImage: () => {
      const img = resolved.value.ogImage ?? SITE_OG_IMAGE;
      return img.startsWith("http") ? img : `${siteUrl}${img}`;
    },
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogUrl: () => {
      const path = resolved.value.path ?? route.path;
      return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
    },
    twitterCard: "summary_large_image",
    twitterTitle: () => resolved.value.title,
    twitterDescription: () => resolved.value.description ?? SITE_DESCRIPTION,
    twitterImage: () => {
      const img = resolved.value.ogImage ?? SITE_OG_IMAGE;
      return img.startsWith("http") ? img : `${siteUrl}${img}`;
    },
    robots: () =>
      resolved.value.indexable === false
        ? "noindex, nofollow"
        : "index, follow"
  });
}
