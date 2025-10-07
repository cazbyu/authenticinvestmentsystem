/*
  # Add OAuth Provider Tracking to User Profiles

  1. Changes to Existing Tables
     - `0008-ap-users` - Add OAuth provider tracking fields
       - `oauth_provider` (text) - OAuth provider name (e.g., 'google', 'email')
       - `oauth_provider_id` (text) - Provider's unique user ID
       - `profile_image_source` (text) - Source of profile image ('oauth', 'custom', 'default')

  2. Security
     - No RLS changes needed - inherits existing policies from table

  3. Important Notes
     - oauth_provider tracks which method user signed up with
     - oauth_provider_id enables account linking detection
     - profile_image_source helps manage profile picture priorities
     - Existing users will have NULL oauth_provider (treated as 'email')
*/

-- Add OAuth provider tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider text DEFAULT 'email';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider_id'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'profile_image_source'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN profile_image_source text DEFAULT 'default';
  END IF;
END $$;

-- Create index for faster OAuth provider lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON "0008-ap-users"(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON "0008-ap-users"(oauth_provider_id);
