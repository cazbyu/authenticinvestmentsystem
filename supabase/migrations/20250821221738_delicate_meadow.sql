/*
  # Create Profile System

  1. New Tables
     - `0008-ap-profiles` - User profile information
     - Storage bucket for profile images

  2. Security
     - Enable RLS on profiles table
     - Add policies for users to manage their own profiles
     - Set up storage policies for profile images

  3. Features
     - Profile information (first_name, last_name, bio)
     - Profile photo support
     - Theme customization (primary_color, accent_color)
*/

-- Create the profiles table
CREATE TABLE IF NOT EXISTS "0008-ap-profiles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  bio text,
  image_path text,
  primary_color text DEFAULT '#0078d4',
  accent_color text DEFAULT '#16a34a',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE "0008-ap-profiles" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can select their own profile" ON "0008-ap-profiles"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON "0008-ap-profiles"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON "0008-ap-profiles"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" ON "0008-ap-profiles"
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function for auto-updating profile timestamps
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to profiles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_profiles_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_profiles_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-profiles"
          FOR EACH ROW
          EXECUTE FUNCTION update_profiles_updated_at();
    END IF;
END $$;

-- Policies for securing the "0008-ap-profile-images" storage bucket
-- These policies ensure that users can only manage images associated with their own user ID

CREATE POLICY "Users can upload their own profile images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own profile images" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own profile images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON "0008-ap-profiles"(user_id);

-- Create trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "0008-ap-profiles" (user_id, first_name, last_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to auth.users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'create_profile_for_new_user_trigger'
    ) THEN
        CREATE TRIGGER create_profile_for_new_user_trigger
          AFTER INSERT ON auth.users
          FOR EACH ROW
          EXECUTE FUNCTION create_profile_for_new_user();
    END IF;
END $$;