import type { Database } from "@hexald/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Database["db"];
    dbClient: Database["client"];
  }

  interface FastifyRequest {
    player?: { id: string };
  }
}

export {};
