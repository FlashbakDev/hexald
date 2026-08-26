-- Recalcule la population village (DEC-013 / DEC-017).
-- Base hôtel de ville = 4 ; cap croissance = 8.
-- Préserve une pop > 4 si le monde montre une vraie progression food
-- (surplus cumulé, ou ferme opérationnelle = chaîne nourriture engagée).

ALTER TABLE "worlds" ALTER COLUMN "population_total" SET DEFAULT 4;
ALTER TABLE "worlds" ALTER COLUMN "population_cap" SET DEFAULT 8;

UPDATE "worlds" SET "population_cap" = 8 WHERE "population_cap" <> 8;

-- Pop sous la base village → remonter à 4
UPDATE "worlds" SET "population_total" = 4 WHERE "population_total" < 4;

-- Pop au-dessus de la base sans preuve de croissance food → revenir à 4
UPDATE "worlds" AS w
SET
  "population_total" = 4,
  "food_surplus_accumulated" = 0
WHERE w."population_total" > 4
  AND w."food_surplus_accumulated" = 0
  AND NOT EXISTS (
    SELECT 1
    FROM "world_tiles" AS t
    WHERE t."world_id" = w."id"
      AND t."building_id" = 'farm'
      AND (
        t."construction_completes_at" IS NULL
        OR t."construction_completes_at" <= NOW()
      )
  );

-- Clamp au cap (sécurité)
UPDATE "worlds"
SET "population_total" = LEAST("population_total", "population_cap");

-- Si trop de workers assignés pour la nouvelle pop, on libère les postes ;
-- le seed lazy (get world) pourra réassigner dans la limite.
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
