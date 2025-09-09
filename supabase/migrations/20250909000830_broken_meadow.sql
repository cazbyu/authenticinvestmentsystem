/*
  # Update User Cycles System for Custom Timelines

  1. Schema Updates
     - Remove the 12-week constraint for custom cycles to allow flexible durations
     - Add support for multiple active cycles per user (one 12-week, multiple custom)
     - Update constraints to support custom timeline functionality

  2. Views Updates
     - Update cycle weeks view to handle variable-length cycles
     - Update days left view for flexible timelines

  3. RPC Functions
     - Update cycle creation function to support flexible durations
*/

-- Remove the 12-week constraint for custom cycles to allow flexible durations
ALTER TABLE "0008-ap-user-cycles" 
DROP CONSTRAINT IF EXISTS ap_uc_12wk_len_chk;

-- Add new constraint that allows flexible durations for custom cycles
ALTER TABLE "0008-ap-user-cycles"
ADD CONSTRAINT ap_uc_flexible_duration_chk 
CHECK (
  (source = 'global' AND global_cycle_id IS NOT NULL AND start_date IS NULL AND end_date IS NULL) OR
  (source = 'custom' AND global_cycle_id IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL AND end_date > start_date)
);

-- Update the unique active constraint to allow multiple custom timelines but only one global cycle
DROP INDEX IF EXISTS ap_user_cycles_one_active_idx;
DROP INDEX IF EXISTS ux_user_cycle_one_active;

-- Create new constraint: only one active global cycle, but multiple active custom timelines allowed
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_cycle_one_active_global 
ON "0008-ap-user-cycles" (user_id) 
WHERE (status = 'active' AND source = 'global');

-- Add timeline_type column to distinguish between different types of custom timelines
ALTER TABLE "0008-ap-user-cycles"
ADD COLUMN IF NOT EXISTS timeline_type text DEFAULT 'cycle' CHECK (timeline_type IN ('cycle', 'project', 'challenge', 'custom'));

-- Update the cycle creation RPC function to support flexible durations
CREATE OR REPLACE FUNCTION ap_create_user_cycle(
  p_source text,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_global_cycle_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_week_start_day text DEFAULT 'monday',
  p_timeline_type text DEFAULT 'cycle'
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

  -- Validate timeline_type parameter
  IF p_timeline_type NOT IN ('cycle', 'project', 'challenge', 'custom') THEN
    RAISE EXCEPTION 'Invalid timeline_type. Must be cycle, project, challenge, or custom';
  END IF;

  IF p_source = 'custom' THEN
    -- Custom cycle/timeline
    IF p_start_date IS NULL OR p_end_date IS NULL THEN
      RAISE EXCEPTION 'Start date and end date are required for custom timelines';
    END IF;
    
    IF p_end_date <= p_start_date THEN
      RAISE EXCEPTION 'End date must be after start date';
    END IF;
    
    v_start_date := p_start_date;
    v_end_date := p_end_date;
    v_title := COALESCE(p_title, 'Custom Timeline');
    
    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, title, start_date, end_date, status, week_start_day, timezone, timeline_type
    ) VALUES (
      v_user_id, 'custom', v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC', p_timeline_type
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSIF p_source = 'global' THEN
    -- Global cycle sync - deactivate existing global cycle first
    UPDATE "0008-ap-user-cycles"
    SET status = 'completed', updated_at = now()
    WHERE user_id = v_user_id AND status = 'active' AND source = 'global';
    
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
      user_id, source, global_cycle_id, title, start_date, end_date, status, week_start_day, timezone, timeline_type
    ) VALUES (
      v_user_id, 'global', p_global_cycle_id, v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC', 'cycle'
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSE
    RAISE EXCEPTION 'Invalid source. Must be custom or global';
  END IF;

  RETURN v_user_cycle_id;
END;
$$;

-- Update the cycle weeks view to handle variable-length cycles
CREATE OR REPLACE VIEW v_user_cycle_weeks AS
SELECT 
  uc.id as user_cycle_id,
  uc.user_id,
  uc.week_start_day,
  uc.source,
  uc.timeline_type,
  week_series.week_number,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks
      (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day'
    ELSE
      -- Monday-anchored weeks  
      (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day'
  END as start_date,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks (end on Saturday)
      (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day' +
      INTERVAL '6 days'
    ELSE
      -- Monday-anchored weeks (end on Sunday)
      (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day' +
      INTERVAL '6 days'
  END as end_date
FROM "0008-ap-user-cycles" uc
CROSS JOIN LATERAL (
  SELECT generate_series(1, 
    CASE 
      WHEN uc.source = 'global' THEN 12  -- Fixed 12 weeks for global cycles
      ELSE CEIL(EXTRACT(EPOCH FROM (uc.end_date - uc.start_date)) / (7 * 24 * 60 * 60))::integer  -- Variable weeks for custom
    END
  ) as week_number
) week_series
WHERE uc.status = 'active';

-- Update the days left view to handle both cycle types
CREATE OR REPLACE VIEW v_user_cycle_days_left AS
SELECT 
  uc.id as user_cycle_id,
  uc.user_id,
  uc.source,
  uc.timeline_type,
  GREATEST(0, (uc.end_date - CURRENT_DATE)::integer) as days_left,
  CASE 
    WHEN uc.end_date <= uc.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - uc.start_date)::numeric / (uc.end_date - uc.start_date)::numeric) * 100
    ))
  END as pct_elapsed
FROM "0008-ap-user-cycles" uc
WHERE uc.status = 'active';

-- Grant access to updated views
GRANT SELECT ON v_user_cycle_weeks TO authenticated;
GRANT SELECT ON v_user_cycle_days_left TO authenticated;
GRANT EXECUTE ON FUNCTION ap_create_user_cycle TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_cycles_timeline_type ON "0008-ap-user-cycles"(timeline_type);
CREATE INDEX IF NOT EXISTS idx_user_cycles_source_status ON "0008-ap-user-cycles"(source, status);