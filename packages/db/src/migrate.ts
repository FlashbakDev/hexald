import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://hexald:hexald@127.0.0.1:5432/hexald";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle"
);

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder });
await client.end();

console.log("Migrations applied:", migrationsFolder);
