```sql
/*
  # Update Universal Join Tables for Custom Goals

  1. Modify `0008-ap-universal-goals-join`
     - Rename `goal_id` to `twelve_wk_goal_id`
     - Add `custom_goal_id` column
     - Add `goal_type` column to distinguish between 12-week and custom goals
     - Add CHECK constraint for polymorphic association
     - Update existing data to set `goal_type`

  2. Update `parent_type` CHECK constraints in other universal join tables
     - Add 'custom_goal' as a valid `parent_type` for linking roles, domains, KRs, and notes to custom goals.
*/

-- Function to drop a check constraint if it exists
CREATE OR REPLACE FUNCTION drop_check_constraint_if_exists(
    p_table_name text,
    p_constraint_name text
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', p_table_name, p_constraint_name);
END;
$$;

-- 1. Modify "0008-ap-universal-goals-join" for polymorphic goal linking
-- Drop existing foreign key constraint on goal_id first
ALTER TABLE "0008-ap-universal-goals-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-goals-join_goal_id_fkey";

-- Rename goal_id to twelve_wk_goal_id
ALTER TABLE "0008-ap-universal-goals-join"
    RENAME COLUMN goal_id TO twelve_wk_goal_id;

-- Add new column for custom goal ID
ALTER TABLE "0008-ap-universal-goals-join"
    ADD COLUMN custom_goal_id uuid REFERENCES "0008-ap-goals-custom"(id) ON DELETE CASCADE;

-- Add goal_type column
ALTER TABLE "0008-ap-universal-goals-join"
    ADD COLUMN goal_type text;

-- Update existing rows to set goal_type for 12-week goals
UPDATE "0008-ap-universal-goals-join"
SET goal_type = 'twelve_wk_goal'
WHERE twelve_wk_goal_id IS NOT NULL;

-- Make twelve_wk_goal_id nullable (it was NOT NULL before)
ALTER TABLE "0008-ap-universal-goals-join"
    ALTER COLUMN twelve_wk_goal_id DROP NOT NULL;

-- Add CHECK constraint for polymorphic goal linking
-- This ensures that exactly one of twelve_wk_goal_id or custom_goal_id is set,
-- and goal_type matches the set ID.
ALTER TABLE "0008-ap-universal-goals-join"
ADD CONSTRAINT chk_goal_type_id
CHECK (
    (goal_type = 'twelve_wk_goal' AND twelve_wk_goal_id IS NOT NULL AND custom_goal_id IS NULL) OR
    (goal_type = 'custom_goal' AND custom_goal_id IS NOT NULL AND twelve_wk_goal_id IS NULL)
);

-- Re-add foreign key constraint for twelve_wk_goal_id (now nullable)
ALTER TABLE "0008-ap-universal-goals-join"
ADD CONSTRAINT "0008-ap-universal-goals-join_twelve_wk_goal_id_fkey"
FOREIGN KEY (twelve_wk_goal_id) REFERENCES "0008-ap-goals-12wk"(id) ON DELETE CASCADE;

-- Add index for custom_goal_id
CREATE INDEX IF NOT EXISTS idx_universal_goals_join_custom_goal_id ON "0008-ap-universal-goals-join"(custom_goal_id);


-- 2. Update `parent_type` CHECK constraints in other universal join tables
-- These tables can now link to 'custom_goal' entities.

-- "0008-ap-universal-roles-join"
SELECT drop_check_constraint_if_exists('0008-ap-universal-roles-join', '0008-ap-universal-roles-join_parent_type_check');
ALTER TABLE "0008-ap-universal-roles-join"
ADD CONSTRAINT "0008-ap-universal-roles-join_parent_type_check"
CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal'));

-- "0008-ap-universal-domains-join"
SELECT drop_check_constraint_if_exists('0008-ap-universal-domains-join', '0008-ap-universal-domains-join_parent_type_check');
ALTER TABLE "0008-ap-universal-domains-join"
ADD CONSTRAINT "0008-ap-universal-domains-join_parent_type_check"
CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal'));

-- "0008-ap-universal-key-relationships-join"
SELECT drop_check_constraint_if_exists('0008-ap-universal-key-relationships-join', '0008-ap-universal-key-relationships-join_parent_type_check');
ALTER TABLE "0008-ap-universal-key-relationships-join"
ADD CONSTRAINT "0008-ap-universal-key-relationships-join_parent_type_check"
CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal'));

-- "0008-ap-universal-notes-join"
SELECT drop_check_constraint_if_exists('0008-ap-universal-notes-join', '0008-ap-universal-notes-join_parent_type_check');
ALTER TABLE "0008-ap-universal-notes-join"
ADD CONSTRAINT "0008-ap-universal-notes-join_parent_type_check"
CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal'));

-- Drop the helper function
DROP FUNCTION drop_check_constraint_if_exists(text, text);
```