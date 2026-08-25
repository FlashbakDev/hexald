ALTER TABLE "world_tiles" ADD COLUMN "default_worker_seeded" boolean DEFAULT false NOT NULL;

UPDATE "world_tiles" SET "default_worker_seeded" = true;
