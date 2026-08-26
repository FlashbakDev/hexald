ALTER TABLE "players" ADD COLUMN "firebase_uid" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_firebase_uid_uidx" ON "players" USING btree ("firebase_uid") WHERE "players"."firebase_uid" is not null;
