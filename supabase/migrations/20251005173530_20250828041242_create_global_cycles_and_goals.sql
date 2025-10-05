/*
  # Create Global Cycles and 12-Week Goals

  1. New Tables
     - `0008-ap-global-cycles` - Global 12-week cycles available to all users
     - `0008-ap-goals-12wk` - 12-week goals that users can create

  2. Security
     - Enable RLS on both tables
     - Global cycles readable by all, goals only by owner

  3. Notes
     - Global cycles are system-defined and shared
     - 12-week goals are user-specific
*/

CREATE TABLE IF NOT EXISTS "0008-ap-global-cycles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS "0008-ap-goals-12wk" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_cycle_id uuid REFERENCES "0008-ap-global-cycles"(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'cancelled')),
  target_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE "0008-ap-global-cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-goals-12wk" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read global cycles" ON "0008-ap-global-cycles"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can select their own 12wk goals" ON "0008-ap-goals-12wk"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 12wk goals" ON "0008-ap-goals-12wk"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 12wk goals" ON "0008-ap-goals-12wk"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own 12wk goals" ON "0008-ap-goals-12wk"
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_global_cycles_active ON "0008-ap-global-cycles"(is_active);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_user_id ON "0008-ap-goals-12wk"(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_global_cycle ON "0008-ap-goals-12wk"(global_cycle_id);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_status ON "0008-ap-goals-12wk"(status);
