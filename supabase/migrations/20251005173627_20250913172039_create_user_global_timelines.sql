/*
  # Create User Global Timelines

  1. New Tables
     - `0008-ap-user-global-timelines` - User activation of global cycles

  2. Security
     - Enable RLS
     - Users manage their own timeline activations

  3. Notes
     - Users can activate multiple global timelines
     - Replaces user_cycles for global timeline management
*/

CREATE TABLE IF NOT EXISTS "0008-ap-user-global-timelines" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_cycle_id uuid NOT NULL REFERENCES "0008-ap-global-cycles"(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  activated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_cycle_id)
);

ALTER TABLE "0008-ap-user-global-timelines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own global timelines" ON "0008-ap-user-global-timelines"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own global timelines" ON "0008-ap-user-global-timelines"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own global timelines" ON "0008-ap-user-global-timelines"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own global timelines" ON "0008-ap-user-global-timelines"
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_global_timelines_user_id ON "0008-ap-user-global-timelines"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_global_cycle ON "0008-ap-user-global-timelines"(global_cycle_id);
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_status ON "0008-ap-user-global-timelines"(status);
