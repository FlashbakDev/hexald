ALTER TABLE "worlds" ALTER COLUMN "population_cap" SET DEFAULT 8;--> statement-breakpoint
UPDATE "worlds" SET "population_cap" = 8 WHERE "population_cap" < 8;
