/*
  # Create Custom Goals System

  1. New Tables
     - `0008-ap-goals-custom` - Custom goals with user-defined start/end dates

  2. Schema
     - `id` (uuid, primary key)
     - `user_id` (uuid, references auth.users)
     - `title` (text, required)
     - `description` (text, optional)
     - `start_date` (date, required)
     - `end_date` (date, required)
     - `status` (text, default 'active')
     - `progress` (integer, 0-100)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  3. Security
     - Enable RLS on custom goals table
     - Add policies for authenticated users to manage their own data

  4. Triggers
     - Auto-update timestamps
*/

-- Create the custom goals table
CREATE TABLE IF NOT EXISTS "0008-ap-goals-custom" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Enable RLS
ALTER TABLE "0008-ap-goals-custom" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom goals
CREATE POLICY "Users can select their own custom goals" ON "0008-ap-goals-custom"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom goals" ON "0008-ap-goals-custom"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom goals" ON "0008-ap-goals-custom"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom goals" ON "0008-ap-goals-custom"
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_goals_custom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to custom goals table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_goals_custom_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_goals_custom_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-goals-custom"
          FOR EACH ROW
          EXECUTE FUNCTION update_goals_custom_updated_at();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_custom_user_id ON "0008-ap-goals-custom"(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_custom_status ON "0008-ap-goals-custom"(status);
CREATE INDEX IF NOT EXISTS idx_goals_custom_dates ON "0008-ap-goals-custom"(start_date, end_date);