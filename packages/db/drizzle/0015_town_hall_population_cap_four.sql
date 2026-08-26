-- Cap HDV = 4 places (DEC-017). Les places supplémentaires viendront des maisons / niveaux.
-- Annule le plafond provisoire à 8 des migrations 0013–0014.

ALTER TABLE "worlds" ALTER COLUMN "population_cap" SET DEFAULT 4;

UPDATE "worlds" SET "population_cap" = 4 WHERE "population_cap" <> 4;

UPDATE "worlds"
SET "population_total" = LEAST("population_total", "population_cap");

-- Workers en trop après clamp pop → libérer ; seed lazy au prochain get world.
UPDATE "world_tiles" AS t
SET
  "assigned_workers" = 0,
  "default_worker_seeded" = false
FROM "worlds" AS w
WHERE t."world_id" = w."id"
  AND (
    SELECT COALESCE(SUM(x."assigned_workers"), 0)
    FROM "world_tiles" AS x
    WHERE x."world_id" = w."id"
  ) > w."population_total";
