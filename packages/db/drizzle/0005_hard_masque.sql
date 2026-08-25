ALTER TABLE "worlds" ADD COLUMN "farmers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "quarriers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "wheat_stock" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "wheat_last_calculated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "stone_stock" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "stone_last_calculated_at" timestamp with time zone DEFAULT now() NOT NULL;