import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("anonymous"),
    pseudo: text("pseudo"),
    /** Clé catalogue portrait (ex. Napoleon). */
    avatarId: text("avatar_id"),
    firebaseUid: text("firebase_uid"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("players_pseudo_lower_uidx")
      .on(sql`lower(${table.pseudo})`)
      .where(sql`${table.pseudo} is not null`),
    uniqueIndex("players_firebase_uid_uidx")
      .on(table.firebaseUid)
      .where(sql`${table.firebaseUid} is not null`)
  ]
);
