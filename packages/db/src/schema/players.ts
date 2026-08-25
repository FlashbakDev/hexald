import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("anonymous"),
    pseudo: text("pseudo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("players_pseudo_lower_uidx")
      .on(sql`lower(${table.pseudo})`)
      .where(sql`${table.pseudo} is not null`)
  ]
);
