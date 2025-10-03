/*
  # Allow Multiple Active Global Timelines

  ## Summary
  Updates the global timeline activation system to allow users to have multiple active global timelines simultaneously.
  Users can activate any available global cycle and manage multiple timelines at once.

  ## Changes Made

  1. **Drop Single Active Constraint**
     - Removes the unique constraint that limited users to one active global timeline
     - Users can now activate multiple global cycles simultaneously

  2. **Update Activation Function**
     - Modified to create new timeline without deactivating existing ones
     - Users can freely add timelines as desired

  3. **Keep Deactivation Function**
     - Deactivation still works to archive timelines and remove goals
     - Users can deactivate individual timelines when desired
*/

-- =====================================================
-- Drop the one-active-global-timeline constraint
-- =====================================================
-- This allows users to have multiple active global timelines
DROP INDEX IF EXISTS ux_user_cycle_one_active_global;

-- =====================================================
-- Update: Activate user global timeline (without deactivating others)
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
  v_new_timeline_id uuid;
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_cycle_title text;
  v_adjusted_start_date date;
  v_adjusted_end_date date;
  v_existing_timeline_id uuid;
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

  -- Check if user already has this exact cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated';
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

  -- Create new active timeline (don't deactivate existing ones)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

-- Add unique constraint to prevent duplicate activations of same cycle
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_global_timeline_unique_cycle
  ON "0008-ap-user-global-timelines"(user_id, global_cycle_id)
  WHERE status = 'active';
