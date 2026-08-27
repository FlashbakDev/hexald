-- Buffer + valve d’entrée + craft processor (scierie, …).
ALTER TABLE "world_tiles" ADD COLUMN "processor_input_rate" integer DEFAULT 0 NOT NULL;
ALTER TABLE "world_tiles" ADD COLUMN "processor_input_buffer" double precision DEFAULT 0 NOT NULL;
ALTER TABLE "world_tiles" ADD COLUMN "processor_input_settled_at" timestamp with time zone;
ALTER TABLE "world_tiles" ADD COLUMN "craft_completes_at" timestamp with time zone;
