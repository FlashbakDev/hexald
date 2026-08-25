CREATE TABLE "world_regions" (
	"world_id" uuid NOT NULL,
	"center_q" integer NOT NULL,
	"center_r" integer NOT NULL,
	"biome" text NOT NULL,
	CONSTRAINT "world_regions_world_id_center_q_center_r_pk" PRIMARY KEY("world_id","center_q","center_r")
);
--> statement-breakpoint
CREATE TABLE "world_tiles" (
	"world_id" uuid NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"biome" text NOT NULL,
	CONSTRAINT "world_tiles_world_id_q_r_pk" PRIMARY KEY("world_id","q","r")
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "world_regions" ADD CONSTRAINT "world_regions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_tiles" ADD CONSTRAINT "world_tiles_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;