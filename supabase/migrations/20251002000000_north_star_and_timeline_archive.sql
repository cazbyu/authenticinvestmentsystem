/*
  # North Star and Timeline Archive Enhancements

  1. Database Updates
    - Add one_yr_goal_id to 0008-ap-universal-goals-join for linking 1-year goals
    - Update goal_type CHECK constraint to include 1-year goals
    - Add year_target_date and priority columns to 0008-ap-goals-1y
    - Add vision_timeframe to 0008-ap-users to distinguish vision types
    - Add indexes for improved query performance
    - Ensure RLS policies on 0008-ap-goals-1y

  2. Security
    - RLS policies for 0008-ap-goals-1y table
    - User isolation for all North Star data

  3. Notes
    - Timeline archive status already supported via existing status columns
    - Mission and vision text fields already exist in 0008-ap-users
*/

-- Add one_yr_goal_id column to universal-goals-join table
ALTER TABLE "0008-ap-universal-goals-join"
  ADD COLUMN IF NOT EXISTS one_yr_goal_id uuid REFERENCES "0008-ap-goals-1y"(id) ON DELETE CASCADE;

-- Update goal_type CHECK constraint to include one_yr_goal
DO $$
BEGIN
  ALTER TABLE "0008-ap-universal-goals-join"
    DROP CONSTRAINT IF EXISTS chk_goal_type_id;

  ALTER TABLE "0008-ap-universal-goals-join"
    ADD CONSTRAINT chk_goal_type_id
    CHECK (
      (goal_type = 'twelve_wk_goal' AND twelve_wk_goal_id IS NOT NULL AND custom_goal_id IS NULL AND one_yr_goal_id IS NULL) OR
      (goal_type = 'custom_goal' AND custom_goal_id IS NOT NULL AND twelve_wk_goal_id IS NULL AND one_yr_goal_id IS NULL) OR
      (goal_type = 'one_yr_goal' AND one_yr_goal_id IS NOT NULL AND twelve_wk_goal_id IS NULL AND custom_goal_id IS NULL)
    );
END $$;

-- Add index for one_yr_goal_id
CREATE INDEX IF NOT EXISTS idx_universal_goals_join_one_yr_goal_id
  ON "0008-ap-universal-goals-join"(one_yr_goal_id);

-- Add year_target_date to 0008-ap-goals-1y
ALTER TABLE "0008-ap-goals-1y"
  ADD COLUMN IF NOT EXISTS year_target_date date;

-- Add priority to 0008-ap-goals-1y
ALTER TABLE "0008-ap-goals-1y"
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10);

-- Add user_id to 0008-ap-goals-1y if it doesn't exist
ALTER TABLE "0008-ap-goals-1y"
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update updated_at column to 0008-ap-goals-1y
ALTER TABLE "0008-ap-goals-1y"
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add vision_timeframe to 0008-ap-users
ALTER TABLE "0008-ap-users"
  ADD COLUMN IF NOT EXISTS vision_timeframe text DEFAULT '5_year' CHECK (vision_timeframe IN ('1_year', '3_year', '5_year', '10_year', 'lifetime'));

-- Add indexes for 0008-ap-goals-1y queries
CREATE INDEX IF NOT EXISTS idx_goals_1y_user_id
  ON "0008-ap-goals-1y"(user_id);

CREATE INDEX IF NOT EXISTS idx_goals_1y_status
  ON "0008-ap-goals-1y"(status);

CREATE INDEX IF NOT EXISTS idx_goals_1y_user_status
  ON "0008-ap-goals-1y"(user_id, status);

-- Enable RLS on 0008-ap-goals-1y
ALTER TABLE "0008-ap-goals-1y" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for 0008-ap-goals-1y
CREATE POLICY "Users can view their own 1-year goals"
  ON "0008-ap-goals-1y"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 1-year goals"
  ON "0008-ap-goals-1y"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 1-year goals"
  ON "0008-ap-goals-1y"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own 1-year goals"
  ON "0008-ap-goals-1y"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update parent_type CHECK constraints to include 1y_goal
DO $$
BEGIN
  -- Update 0008-ap-universal-roles-join
  ALTER TABLE "0008-ap-universal-roles-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-roles-join_parent_type_check";

  ALTER TABLE "0008-ap-universal-roles-join"
    ADD CONSTRAINT "0008-ap-universal-roles-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', '1y_goal'));

  -- Update 0008-ap-universal-domains-join
  ALTER TABLE "0008-ap-universal-domains-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-domains-join_parent_type_check";

  ALTER TABLE "0008-ap-universal-domains-join"
    ADD CONSTRAINT "0008-ap-universal-domains-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', '1y_goal'));

  -- Update 0008-ap-universal-key-relationships-join
  ALTER TABLE "0008-ap-universal-key-relationships-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-key-relationships-join_parent_type_check";

  ALTER TABLE "0008-ap-universal-key-relationships-join"
    ADD CONSTRAINT "0008-ap-universal-key-relationships-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', '1y_goal'));

  -- Update 0008-ap-universal-notes-join
  ALTER TABLE "0008-ap-universal-notes-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-notes-join_parent_type_check";

  ALTER TABLE "0008-ap-universal-notes-join"
    ADD CONSTRAINT "0008-ap-universal-notes-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', '1y_goal'));
END $$;

-- Create trigger to update updated_at timestamp for 0008-ap-goals-1y
CREATE OR REPLACE FUNCTION update_goals_1y_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goals_1y_updated_at_trigger
  BEFORE UPDATE ON "0008-ap-goals-1y"
  FOR EACH ROW
  EXECUTE FUNCTION update_goals_1y_updated_at();
