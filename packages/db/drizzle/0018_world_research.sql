ALTER TABLE "worlds" ADD COLUMN "research_target_tech_id" text;
--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "science_last_settled_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE TABLE "world_unlocked_techs" (
	"world_id" uuid NOT NULL,
	"tech_id" text NOT NULL,
	CONSTRAINT "world_unlocked_techs_world_id_tech_id_pk" PRIMARY KEY("world_id","tech_id")
);
--> statement-breakpoint
CREATE TABLE "world_tech_progress" (
	"world_id" uuid NOT NULL,
	"tech_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "world_tech_progress_world_id_tech_id_pk" PRIMARY KEY("world_id","tech_id")
);
--> statement-breakpoint
ALTER TABLE "world_unlocked_techs" ADD CONSTRAINT "world_unlocked_techs_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "world_tech_progress" ADD CONSTRAINT "world_tech_progress_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "world_unlocked_techs" ("world_id", "tech_id")
SELECT "id", 'foundations' FROM "worlds"
ON CONFLICT DO NOTHING;
