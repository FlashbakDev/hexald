import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Database = ReturnType<typeof createDb>;

/** Connexion racine ou transaction Drizzle (même surface pour les helpers monde). */
export type WorldDb = Database["db"] | Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function pingDb(db: Database["db"]) {
  await db.execute(sql`select 1`);
}
