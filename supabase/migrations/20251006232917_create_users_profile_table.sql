/*
  # Create Users Profile Table

  1. New Tables
     - `0008-ap-users` - User profile information with North Star data
       - `id` (uuid, primary key)
       - `user_id` (uuid, references auth.users)
       - `first_name` (text)
       - `last_name` (text)
       - `profile_image` (text)
       - `mission_text` (text) - User's mission statement
       - `vision_text` (text) - User's 5-year vision
       - `vision_timeframe` (text) - Vision timeframe type
       - `primary_color` (text) - User's primary theme color
       - `accent_color` (text) - User's accent theme color
       - `created_at` (timestamptz)
       - `updated_at` (timestamptz)

  2. Security
     - Enable RLS on `0008-ap-users` table
     - Add policies for authenticated users to manage their own profile

  3. Important Notes
     - This table stores user profile data including North Star aspirations
     - Each auth user should have exactly one profile record
     - The `user_id` field is unique and references auth.users
*/

-- Create the users profile table
CREATE TABLE IF NOT EXISTS "0008-ap-users" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  profile_image text,
  mission_text text,
  vision_text text,
  vision_timeframe text DEFAULT '5_year',
  primary_color text DEFAULT '#0078d4',
  accent_color text DEFAULT '#16a34a',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE "0008-ap-users" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users profile
CREATE POLICY "Users can select their own profile" ON "0008-ap-users"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON "0008-ap-users"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON "0008-ap-users"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" ON "0008-ap-users"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_user_id ON "0008-ap-users"(user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_0008_ap_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_0008_ap_users_updated_at
    BEFORE UPDATE ON "0008-ap-users"
    FOR EACH ROW
    EXECUTE FUNCTION update_0008_ap_users_updated_at();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "0008-ap-users" (user_id, first_name, last_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger to auto-create profile for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_profile();
