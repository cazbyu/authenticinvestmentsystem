/*
  # Force Refresh Activation Function

  This migration drops and recreates the activation function to force
  PostgREST to refresh its schema cache and recognize the function.

  This is a workaround for PGRST202 "function not found in schema cache" errors.
*/

-- Drop and recreate the activation function
DROP FUNCTION IF EXISTS fn_activate_user_global_timeline(uuid, text);

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
  v_existing_timeline_id uuid;
  v_cycle_exists boolean;
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

  -- Verify global cycle exists and is active
  SELECT EXISTS(
    SELECT 1 FROM "0008-ap-global-cycles"
    WHERE id = p_global_cycle_id
      AND (status = 'active' OR status IS NULL)
  ) INTO v_cycle_exists;

  IF NOT v_cycle_exists THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
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

  -- Create new active timeline (normalized: only store references)
  INSERT INTO "0008-ap-user-global-timelines" (
    user_id,
    global_cycle_id,
    status,
    week_start_day,
    activated_at
  ) VALUES (
    v_user_id,
    p_global_cycle_id,
    'active',
    p_week_start_day,
    now()
  )
  RETURNING id INTO v_new_timeline_id;

  RETURN v_new_timeline_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
