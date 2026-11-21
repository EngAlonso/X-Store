ALTER TABLE "xstore_platform_settings"
  ADD COLUMN IF NOT EXISTS "backup_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "backup_frequency_per_day" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "backup_next_run_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "backup_last_run_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "backup_last_status" text,
  ADD COLUMN IF NOT EXISTS "backup_last_error" text,
  ADD COLUMN IF NOT EXISTS "google_drive_refresh_token_encrypted" text,
  ADD COLUMN IF NOT EXISTS "google_drive_folder_id" text,
  ADD COLUMN IF NOT EXISTS "google_drive_connected_at" timestamptz;
