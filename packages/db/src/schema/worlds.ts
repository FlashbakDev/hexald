import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { players } from "./players.ts";

export const worlds = pgTable("worlds", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const worldTiles = pgTable(
  "world_tiles",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    biome: text("biome").notNull()
  },
  (table) => [primaryKey({ columns: [table.worldId, table.q, table.r] })]
);

export const worldRegions = pgTable(
  "world_regions",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    centerQ: integer("center_q").notNull(),
    centerR: integer("center_r").notNull(),
    biome: text("biome").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.worldId, table.centerQ, table.centerR] })
  ]
);
