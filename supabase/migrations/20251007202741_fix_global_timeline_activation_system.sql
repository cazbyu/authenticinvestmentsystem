/*
  # Fix Global Timeline Activation System

  ## Summary
  Implements the global timeline activation system with a normalized schema design.
  The table stores only references (user_id, global_cycle_id), and data like title,
  start_date, end_date are retrieved via joins with the global_cycles table.

  ## Changes Made

  1. **Add week_start_day column**
     - Stores user's preference for week start day (sunday or monday)
     - Used by views to calculate week boundaries correctly

  2. **Create activation function**
     - `fn_activate_user_global_timeline`: Creates user timeline activation
     - Only inserts: user_id, global_cycle_id, status, week_start_day, activated_at
     - Does NOT store title, start_date, end_date (retrieved via joins)

  3. **Create deactivation function**
     - `fn_deactivate_user_global_timeline`: Archives timeline
     - Deactivation cascades handled by database foreign key constraints

  ## Security
  - All functions use SECURITY DEFINER with proper user verification
  - RLS policies enforce user ownership

  ## Notes
  - The normalized design avoids data duplication
  - Frontend must join with global_cycles to get title and dates
  - Views dynamically generate weeks using generate_series
  - Tasks and goals link directly to global_cycle_id or via user_global_timeline_id
*/

-- =====================================================
-- Add week_start_day column if not exists
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines'
      AND column_name = 'week_start_day'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
      ADD COLUMN week_start_day text DEFAULT 'sunday' CHECK (week_start_day IN ('sunday', 'monday'));
    
    -- Set default for existing rows
    UPDATE "0008-ap-user-global-timelines" 
    SET week_start_day = 'sunday' 
    WHERE week_start_day IS NULL;
  END IF;
END $$;

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
  SELECT user_id 
  INTO v_timeline_user_id
  FROM "0008-ap-user-global-timelines"
  WHERE id = p_user_global_timeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timeline not found';
  END IF;

  IF v_timeline_user_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized to deactivate this timeline';
  END IF;

  -- Set timeline status to archived
  -- Cascade deletion handled by foreign key constraints
  UPDATE "0008-ap-user-global-timelines"
  SET status = 'archived',
      updated_at = now()
  WHERE id = p_user_global_timeline_id
    AND user_id = v_user_id;

  RETURN true;
END;
$$;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_deactivate_user_global_timeline(uuid) TO authenticated;

-- =====================================================
-- Add indexes for performance
-- =====================================================

-- Add unique constraint to prevent duplicate activations of same cycle
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_global_timeline_unique_cycle
  ON "0008-ap-user-global-timelines"(user_id, global_cycle_id)
  WHERE status = 'active';

-- Add index for active timelines query performance
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_user_active
  ON "0008-ap-user-global-timelines"(user_id, status)
  WHERE status = 'active';

-- Add index for week_start_day queries
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_week_start
  ON "0008-ap-user-global-timelines"(user_id, week_start_day)
  WHERE status = 'active';
