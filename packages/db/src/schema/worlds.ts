import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players.ts";

/** Pointe de rivière à prolonger (écoulement sortant). */
export type RiverTipRow = { q: number; r: number; dir: number; atVertex?: boolean };

export const worlds = pgTable("worlds", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  /** Population (stocks → world_inventory). */
  populationTotal: integer("population_total").notNull().default(4),
  populationCap: integer("population_cap").notNull().default(4),
  /** DEC-017 — surplus food cumulé vers +1 pop. */
  foodSurplusAccumulated: integer("food_surplus_accumulated").notNull().default(0),
  /** Agrégats dénormalisés (vérité = world_tiles.assigned_workers). */
  woodcutters: integer("woodcutters").notNull().default(0),
  farmers: integer("farmers").notNull().default(0),
  quarriers: integer("quarriers").notNull().default(0),
  /** Tech cible active (DEC-022) ; null = pause. */
  researchTargetTechId: text("research_target_tech_id"),
  /** Horloge prod science HDV (ms epoch stocké en timestamptz). */
  scienceLastSettledAt: timestamp("science_last_settled_at", {
    withTimezone: true
  })
    .defaultNow()
    .notNull(),
  /** Pointes de rivières à prolonger à la prochaine expansion. */
  riverTips: jsonb("river_tips")
    .$type<RiverTipRow[]>()
    .notNull()
    .default(sql`'[]'::jsonb`)
});

/** Inventaire générique — une ligne par (monde, ressource). */
export const worldInventory = pgTable(
  "world_inventory",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull(),
    amount: doublePrecision("amount").notNull().default(0),
    lastCalculatedAt: timestamp("last_calculated_at", {
      withTimezone: true
    })
      .defaultNow()
      .notNull()
  },
  (table) => [primaryKey({ columns: [table.worldId, table.resourceId] })]
);

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
    defaultWorkerSeeded: boolean("default_worker_seeded").notNull().default(false),
    /** POI naturel / landmark (ex. fish_bank). */
    poiId: text("poi_id"),
    /** Bits 0–5 : arêtes terre–terre avec rivière (HEX_DIRECTIONS). */
    riverMask: integer("river_mask").notNull().default(0),
    /** Valve d’entrée processor : unités input / min depuis le stock village. */
    processorInputRate: integer("processor_input_rate").notNull().default(0),
    /** Buffer d’input local (ex. bois dans la scierie). */
    processorInputBuffer: doublePrecision("processor_input_buffer")
      .notNull()
      .default(0),
    /** Horloge d’accumulation du buffer. */
    processorInputSettledAt: timestamp("processor_input_settled_at", {
      withTimezone: true
    }),
    /** Fin du craft en cours ; null = idle. */
    craftCompletesAt: timestamp("craft_completes_at", {
      withTimezone: true
    })
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

export const worldUnlockedTechs = pgTable(
  "world_unlocked_techs",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    techId: text("tech_id").notNull()
  },
  (table) => [primaryKey({ columns: [table.worldId, table.techId] })]
);

export const worldTechProgress = pgTable(
  "world_tech_progress",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    techId: text("tech_id").notNull(),
    progress: integer("progress").notNull().default(0)
  },
  (table) => [primaryKey({ columns: [table.worldId, table.techId] })]
);
