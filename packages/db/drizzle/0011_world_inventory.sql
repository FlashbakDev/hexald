CREATE TABLE "world_inventory" (
	"world_id" uuid NOT NULL,
	"resource_id" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_inventory_world_id_resource_id_pk" PRIMARY KEY("world_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "world_inventory" ADD CONSTRAINT "world_inventory_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "world_inventory" ("world_id", "resource_id", "amount", "last_calculated_at")
SELECT "id", 'wood', "wood_stock", "wood_last_calculated_at" FROM "worlds"
UNION ALL
SELECT "id", 'wheat', "wheat_stock", "wheat_last_calculated_at" FROM "worlds"
UNION ALL
SELECT "id", 'stone', "stone_stock", "stone_last_calculated_at" FROM "worlds";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "wood_stock";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "wood_last_calculated_at";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "wheat_stock";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "wheat_last_calculated_at";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "stone_stock";
--> statement-breakpoint
ALTER TABLE "worlds" DROP COLUMN "stone_last_calculated_at";
