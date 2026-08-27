-- Rivières style Civ : masque d’arêtes par tuile + pointes à prolonger.
ALTER TABLE "world_tiles" ADD COLUMN "river_mask" integer DEFAULT 0 NOT NULL;
ALTER TABLE "worlds" ADD COLUMN "river_tips" jsonb DEFAULT '[]'::jsonb NOT NULL;
