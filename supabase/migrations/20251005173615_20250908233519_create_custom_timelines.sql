/*
  # Create Custom Timeline System

  1. New Tables
     - `0008-ap-custom-timelines` - Custom timeline containers

  2. Schema Changes
     - Add custom_timeline_id references to goals tables

  3. Security
     - Enable RLS
     - Users manage their own timelines

  4. Views
     - Calculate weeks for custom timelines
*/

CREATE TABLE IF NOT EXISTS "0008-ap-custom-timelines" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_custom_timeline_date_range CHECK (end_date > start_date)
);

ALTER TABLE "0008-ap-custom-timelines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own custom timelines" ON "0008-ap-custom-timelines"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own custom timelines" ON "0008-ap-custom-timelines"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own custom timelines" ON "0008-ap-custom-timelines"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own custom timelines" ON "0008-ap-custom-timelines"
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE "0008-ap-goals-12wk"
  ADD COLUMN IF NOT EXISTS custom_timeline_id uuid REFERENCES "0008-ap-custom-timelines"(id) ON DELETE CASCADE;

ALTER TABLE "0008-ap-goals-custom"
  ADD COLUMN IF NOT EXISTS custom_timeline_id uuid REFERENCES "0008-ap-custom-timelines"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_custom_timelines_user_id ON "0008-ap-custom-timelines"(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_timelines_status ON "0008-ap-custom-timelines"(status);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_custom_timeline ON "0008-ap-goals-12wk"(custom_timeline_id);
CREATE INDEX IF NOT EXISTS idx_goals_custom_custom_timeline_2 ON "0008-ap-goals-custom"(custom_timeline_id);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_timeline ON "0008-ap-tasks"(custom_timeline_id);
