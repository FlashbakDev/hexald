-- Aligne les mondes legacy (cap 12, total 8) sur l’économie v0 actuelle.
UPDATE "worlds" SET "population_cap" = 4 WHERE "population_cap" <> 4;
UPDATE "worlds" SET "population_total" = LEAST("population_total", "population_cap");
ALTER TABLE "worlds" ALTER COLUMN "population_cap" SET DEFAULT 4;
