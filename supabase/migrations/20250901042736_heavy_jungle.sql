/*
  # Add Week Start Day Support to User Cycles

  1. Schema Changes
     - Add `week_start_day` column to user cycles table
     - Add `timezone` column for future timezone support

  2. RPC Function Updates
     - Update `ap_create_user_cycle` to accept week start day parameter
     - Update cycle weeks view to respect week start day

  3. Security
     - Maintain existing RLS policies
*/

-- Add week_start_day column to user cycles table
ALTER TABLE "0008-ap-user-cycles"
  ADD COLUMN IF NOT EXISTS week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Create or replace the user cycle creation RPC function
CREATE OR REPLACE FUNCTION ap_create_user_cycle(
  p_source text,
  p_start_date date DEFAULT NULL,
  p_global_cycle_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_week_start_day text DEFAULT 'monday'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_start_date date;
  v_end_date date;
  v_title text;
  v_user_cycle_id uuid;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day parameter
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Deactivate any existing active cycles for this user
  UPDATE "0008-ap-user-cycles"
  SET status = 'completed', updated_at = now()
  WHERE user_id = v_user_id AND status = 'active';

  IF p_source = 'custom' THEN
    -- Custom cycle
    IF p_start_date IS NULL THEN
      RAISE EXCEPTION 'Start date is required for custom cycles';
    END IF;
    
    v_start_date := p_start_date;
    v_end_date := p_start_date + INTERVAL '83 days'; -- 12 weeks minus 1 day
    v_title := COALESCE(p_title, 'Custom 12-Week Cycle');
    
    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, title, start_date, end_date, status, week_start_day, timezone
    ) VALUES (
      v_user_id, 'custom', v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC'
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSIF p_source = 'global' THEN
    -- Global cycle sync
    IF p_global_cycle_id IS NULL THEN
      RAISE EXCEPTION 'Global cycle ID is required for global cycles';
    END IF;
    
    -- Get global cycle data
    SELECT start_date, end_date, title
    INTO v_start_date, v_end_date, v_title
    FROM "0008-ap-global-cycles"
    WHERE id = p_global_cycle_id AND is_active = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Global cycle not found or not active';
    END IF;
    
    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, global_cycle_id, title, start_date, end_date, status, week_start_day, timezone
    ) VALUES (
      v_user_id, 'global', p_global_cycle_id, v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC'
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSE
    RAISE EXCEPTION 'Invalid source. Must be custom or global';
  END IF;

  RETURN v_user_cycle_id;
END;
$$;

-- Create or replace the view for user cycle weeks that respects week start day
CREATE OR REPLACE VIEW v_user_cycle_weeks AS
SELECT 
  uc.id as user_cycle_id,
  uc.user_id,
  uc.week_start_day,
  generate_series(1, 12) as week_number,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day'
    ELSE
      -- Monday-anchored weeks  
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day'
  END as starts_on,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks (end on Saturday)
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day' +
      INTERVAL '6 days'
    ELSE
      -- Monday-anchored weeks (end on Sunday)
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day' +
      INTERVAL '6 days'
  END as ends_on
FROM "0008-ap-user-cycles" uc
WHERE uc.status = 'active';

-- Grant access to the view
GRANT SELECT ON v_user_cycle_weeks TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_cycles_week_start_day ON "0008-ap-user-cycles"(week_start_day);
CREATE INDEX IF NOT EXISTS idx_user_cycles_status_user ON "0008-ap-user-cycles"(status, user_id);