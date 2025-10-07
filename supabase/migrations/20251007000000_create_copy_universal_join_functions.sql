/*
  # Create helper functions to copy universal joins

  1. Functions
    - `ap_copy_universal_roles_to_task`: Copy role joins from parent task to child task
    - `ap_copy_universal_domains_to_task`: Copy domain joins from parent task to child task
    - `ap_copy_universal_goals_to_task`: Copy goal joins from parent task to child task

  2. Purpose
    - When creating task occurrences (completions), copy all associations from parent
    - Ensures completed tasks maintain proper roles, domains, and goals for scoring
    - Supports consistent Authentic Score calculation across all completion sources
*/

-- Copy role joins from one task to another
CREATE OR REPLACE FUNCTION ap_copy_universal_roles_to_task(
  from_parent_id UUID,
  to_task_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "0008-ap-universal-roles-join" (
    parent_id,
    parent_type,
    role_id,
    user_id,
    created_at,
    updated_at
  )
  SELECT
    to_task_id,
    'task',
    role_id,
    user_id,
    NOW(),
    NOW()
  FROM "0008-ap-universal-roles-join"
  WHERE parent_id = from_parent_id
    AND parent_type = 'task'
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Copy domain joins from one task to another
CREATE OR REPLACE FUNCTION ap_copy_universal_domains_to_task(
  from_parent_id UUID,
  to_task_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "0008-ap-universal-domains-join" (
    parent_id,
    parent_type,
    domain_id,
    user_id,
    created_at,
    updated_at
  )
  SELECT
    to_task_id,
    'task',
    domain_id,
    user_id,
    NOW(),
    NOW()
  FROM "0008-ap-universal-domains-join"
  WHERE parent_id = from_parent_id
    AND parent_type = 'task'
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Copy goal joins from one task to another
CREATE OR REPLACE FUNCTION ap_copy_universal_goals_to_task(
  from_parent_id UUID,
  to_task_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "0008-ap-universal-goals-join" (
    parent_id,
    parent_type,
    goal_type,
    twelve_wk_goal_id,
    custom_goal_id,
    user_id,
    created_at,
    updated_at
  )
  SELECT
    to_task_id,
    'task',
    goal_type,
    twelve_wk_goal_id,
    custom_goal_id,
    user_id,
    NOW(),
    NOW()
  FROM "0008-ap-universal-goals-join"
  WHERE parent_id = from_parent_id
    AND parent_type = 'task'
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
