/*
  # Create Custom Goals Table

  1. New Tables
     - `0008-ap-goals-custom` - Custom goals not tied to 12-week cycles

  2. Security
     - Enable RLS
     - Users can only manage their own custom goals

  3. Notes
     - Custom goals are flexible and not bound to timeline constraints
     - Support for custom timeline associations
*/

CREATE TABLE IF NOT EXISTS "0008-ap-goals-custom" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'cancelled')),
  target_date date,
  custom_timeline_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE "0008-ap-goals-custom" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own custom goals" ON "0008-ap-goals-custom"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own custom goals" ON "0008-ap-goals-custom"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own custom goals" ON "0008-ap-goals-custom"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own custom goals" ON "0008-ap-goals-custom"
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_custom_user_id ON "0008-ap-goals-custom"(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_custom_status ON "0008-ap-goals-custom"(status);
CREATE INDEX IF NOT EXISTS idx_goals_custom_custom_timeline ON "0008-ap-goals-custom"(custom_timeline_id);
