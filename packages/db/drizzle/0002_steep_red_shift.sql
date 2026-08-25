ALTER TABLE "players" ADD COLUMN "pseudo" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_pseudo_lower_uidx" ON "players" USING btree (lower("pseudo")) WHERE "players"."pseudo" is not null;