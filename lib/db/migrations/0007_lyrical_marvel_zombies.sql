ALTER TABLE "xstore_team_members" ADD COLUMN "role_name" text;--> statement-breakpoint
ALTER TABLE "xstore_team_members" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_users" ADD COLUMN "role_name" text;--> statement-breakpoint
ALTER TABLE "xstore_users" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;