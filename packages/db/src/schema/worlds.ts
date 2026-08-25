import {
  boolean,
  doublePrecision,
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  /** Économie v0 — pop + extracteurs */
  populationTotal: integer("population_total").notNull().default(4),
  populationCap: integer("population_cap").notNull().default(4),
  woodcutters: integer("woodcutters").notNull().default(0),
  farmers: integer("farmers").notNull().default(0),
  quarriers: integer("quarriers").notNull().default(0),
  woodStock: doublePrecision("wood_stock").notNull().default(30),
  woodLastCalculatedAt: timestamp("wood_last_calculated_at", {
    withTimezone: true
  })
    .defaultNow()
    .notNull(),
  wheatStock: doublePrecision("wheat_stock").notNull().default(0),
  wheatLastCalculatedAt: timestamp("wheat_last_calculated_at", {
    withTimezone: true
  })
    .defaultNow()
    .notNull(),
  stoneStock: doublePrecision("stone_stock").notNull().default(0),
  stoneLastCalculatedAt: timestamp("stone_last_calculated_at", {
    withTimezone: true
  })
    .defaultNow()
    .notNull()
});

export const worldTiles = pgTable(
  "world_tiles",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    biome: text("biome").notNull(),
    buildingId: text("building_id"),
    /** Fin de chantier ; null = bâtiment opérationnel (ou tuile vide). */
    constructionCompletesAt: timestamp("construction_completes_at", {
      withTimezone: true
    }),
    /** Workers assignés sur ce site (0–1 pour extracteur niveau 1). */
    assignedWorkers: integer("assigned_workers").notNull().default(0),
    /** Worker par défaut déjà géré (évite réassigner si le joueur retire). */
    defaultWorkerSeeded: boolean("default_worker_seeded").notNull().default(false)
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
