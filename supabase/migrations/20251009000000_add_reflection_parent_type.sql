/*
  # Add Reflection Parent Type to Universal Join Tables

  1. Changes
    - Add 'reflection' as a valid parent_type to universal-roles-join table
    - Add 'reflection' as a valid parent_type to universal-domains-join table
    - Add 'reflection' as a valid parent_type to universal-key-relationships-join table
    - Add 'reflection' as a valid parent_type to universal-notes-join table

  2. Purpose
    - Allow daily and weekly reflections to be associated with roles, domains, key relationships, and notes
    - Enables comprehensive journaling with contextual associations

  3. Security
    - No RLS changes needed; existing policies apply
*/

-- Update universal-roles-join to support 'reflection' parent_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = '0008-ap-universal-roles-join'
    AND constraint_name LIKE '%parent_type%'
  ) THEN
    ALTER TABLE "0008-ap-universal-roles-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-roles-join_parent_type_check";

    ALTER TABLE "0008-ap-universal-roles-join"
    ADD CONSTRAINT "0008-ap-universal-roles-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', 'reflection'));
  END IF;
END $$;

-- Update universal-domains-join to support 'reflection' parent_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = '0008-ap-universal-domains-join'
    AND constraint_name LIKE '%parent_type%'
  ) THEN
    ALTER TABLE "0008-ap-universal-domains-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-domains-join_parent_type_check";

    ALTER TABLE "0008-ap-universal-domains-join"
    ADD CONSTRAINT "0008-ap-universal-domains-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', 'reflection'));
  END IF;
END $$;

-- Update universal-key-relationships-join to support 'reflection' parent_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = '0008-ap-universal-key-relationships-join'
    AND constraint_name LIKE '%parent_type%'
  ) THEN
    ALTER TABLE "0008-ap-universal-key-relationships-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-key-relationships-join_parent_type_check";

    ALTER TABLE "0008-ap-universal-key-relationships-join"
    ADD CONSTRAINT "0008-ap-universal-key-relationships-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', 'reflection'));
  END IF;
END $$;

-- Update universal-notes-join to support 'reflection' parent_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = '0008-ap-universal-notes-join'
    AND constraint_name LIKE '%parent_type%'
  ) THEN
    ALTER TABLE "0008-ap-universal-notes-join"
    DROP CONSTRAINT IF EXISTS "0008-ap-universal-notes-join_parent_type_check";

    ALTER TABLE "0008-ap-universal-notes-join"
    ADD CONSTRAINT "0008-ap-universal-notes-join_parent_type_check"
    CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal', 'reflection'));
  END IF;
END $$;
