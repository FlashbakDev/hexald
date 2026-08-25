ALTER TABLE "worlds" ADD COLUMN "population_total" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "population_cap" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "woodcutters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "wood_stock" double precision DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "wood_last_calculated_at" timestamp with time zone DEFAULT now() NOT NULL;