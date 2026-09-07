import { defineCollection, defineContentConfig, z } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    wikiBuildings: defineCollection({
      type: "page",
      source: "wiki/buildings/*.md",
      schema: z.object({
        /** Accroche courte sous le titre / meta description. */
        summary: z.string()
      })
    })
  }
});
