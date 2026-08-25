import type { FastifyInstance } from "fastify";
import { biomes, buildings, chains, resources } from "@hexald/content";

export async function contentRoutes(app: FastifyInstance) {
  app.get("/content", async () => ({
    biomes,
    resources,
    buildings,
    chains
  }));
}
