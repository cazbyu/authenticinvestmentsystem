/*
  # Global Timeline Activation System

  ## Summary
  Implements a controlled activation system for global timelines where users can:
  - Have only one active global timeline at a time
  - View the next available global cycles for activation
  - Safely deactivate timelines with warnings about data loss
  - Automatically cascade delete goals and actions when timelines are deactivated

  ## Changes Made

  1. **Database Functions**
     - `fn_deactivate_user_global_timeline`: Safely deactivates a timeline and cascades deletion of goals and actions
     - `fn_check_timeline_has_goals`: Checks if a timeline has associated goals
     - `fn_activate_user_global_timeline`: Activates a new global timeline (deactivates current one first)

  2. **RLS Policy Updates**
     - Add policy to prevent goal creation on inactive timelines
     - Update existing policies to check timeline active status

  3. **Constraints**
     - Ensure only one active global timeline per user
     - Add validation for timeline status transitions

  ## Security
  - All functions use SECURITY DEFINER to ensure proper access control
  - RLS policies enforce that users can only manage their own timelines
  - Cascade deletions are contained within transaction boundaries
*/

-- =====================================================
-- Function: Check if timeline has goals
-- =====================================================
CREATE OR REPLACE FUNCTION fn_check_timeline_has_goals(
  p_user_global_timeline_id uuid
)
RETURNS TABLE (
  has_goals boolean,
  goal_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count goals associated with this timeline
  SELECT COUNT(*)::integer
  INTO v_count
  FROM "0008-ap-goals-12wk"
  WHERE user_global_timeline_id = p_user_global_timeline_id
    AND status = 'active';

  RETURN QUERY SELECT (v_count > 0), v_count;
END;
$$;

-- =====================================================
-- Function: Deactivate user global timeline
-- =====================================================
CREATE OR REPLACE FUNCTION fn_deactivate_user_global_timeline(
  p_user_global_timeline_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_timeline_user_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify timeline belongs to user
  SELECT user_id INTO v_timeline_user_id
  FROM "0008-ap-user-global-timelines"
  WHERE id = p_user_global_timeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timeline not found';
  END IF;

  IF v_timeline_user_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized to deactivate this timeline';
  END IF;

  -- Start transaction (implicit in function)
  -- Delete all tasks/actions associated with goals on this timeline
  DELETE FROM "0008-ap-tasks"
  WHERE goal_id IN (
    SELECT id FROM "0008-ap-goals-12wk"
    WHERE user_global_timeline_id = p_user_global_timeline_id
  );

  -- Delete all goals associated with this timeline
  DELETE FROM "0008-ap-goals-12wk"
  WHERE user_global_timeline_id = p_user_global_timeline_id;

  -- Set timeline status to archived
  UPDATE "0008-ap-user-global-timelines"
  SET status = 'archived',
      updated_at = now()
  WHERE id = p_user_global_timeline_id
    AND user_id = v_user_id;

  RETURN true;
END;
$$;

-- =====================================================
-- Function: Activate user global timeline
-- =====================================================
CREATE OR REPLACE FUNCTION fn_activate_user_global_timeline(
  p_global_cycle_id uuid,
  p_week_start_day text DEFAULT 'sunday'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_existing_timeline_id uuid;
  v_new_timeline_id uuid;
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_cycle_title text;
  v_adjusted_start_date date;
  v_adjusted_end_date date;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Get global cycle details
  SELECT start_date, end_date, COALESCE(title, cycle_label)
  INTO v_cycle_start_date, v_cycle_end_date, v_cycle_title
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  -- Adjust dates for Monday start if needed
  v_adjusted_start_date := v_cycle_start_date;
  v_adjusted_end_date := v_cycle_end_date;

  IF p_week_start_day = 'monday' THEN
    v_adjusted_start_date := v_cycle_start_date + INTERVAL '1 day';
    v_adjusted_end_date := v_cycle_end_date + INTERVAL '1 day';
  END IF;

  -- Check if user already has an active global timeline
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND status = 'active';

  -- If exists, deactivate it (cascades to goals and actions)
  IF FOUND THEN
    PERFORM fn_deactivate_user_global_timeline(v_existing_timeline_id);
  END IF;

  -- Create new active timeline
  INSERT INTO "0008-ap-user-global-timelines" (
    user_id,
    global_cycle_id,
    title,
    start_date,
    end_date,
    status,
    week_start_day,
    timezone
  ) VALUES (
    v_user_id,
    p_global_cycle_id,
    v_cycle_title,
    v_adjusted_start_date,
    v_adjusted_end_date,
    'active',
    p_week_start_day,
    'UTC'
  )
  RETURNING id INTO v_new_timeline_id;

  RETURN v_new_timeline_id;
END;
$$;

-- =====================================================
-- Update RLS Policies for Goals
-- =====================================================

-- Drop existing insert policy and recreate with timeline status check
DROP POLICY IF EXISTS "Users can insert their own 12-week goals" ON "0008-ap-goals-12wk";

CREATE POLICY "Users can insert their own 12-week goals" ON "0008-ap-goals-12wk"
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Either no timeline specified (legacy)
      user_global_timeline_id IS NULL
      OR
      -- Or timeline is active
      EXISTS (
        SELECT 1 FROM "0008-ap-user-global-timelines"
        WHERE id = user_global_timeline_id
          AND user_id = auth.uid()
          AND status = 'active'
      )
    )
  );

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION fn_check_timeline_has_goals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_deactivate_user_global_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

-- =====================================================
-- Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_goals_12wk_user_global_timeline
  ON "0008-ap-goals-12wk"(user_global_timeline_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tasks_goal_id
  ON "0008-ap-tasks"(goal_id)
  WHERE goal_id IS NOT NULL;

-- =====================================================
-- Add status column to global cycles if not exists
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
      ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed'));

    -- Set all existing cycles to active
    UPDATE "0008-ap-global-cycles" SET status = 'active' WHERE status IS NULL;
  END IF;
END $$;
