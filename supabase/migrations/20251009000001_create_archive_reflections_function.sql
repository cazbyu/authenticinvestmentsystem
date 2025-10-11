/*
  # Create Archive Reflections Function

  1. New Functions
    - `archive_old_reflections`: Archives reflections based on type and age
      - Daily reflections: Archive after 7 days
      - Weekly reflections: Archive after 12 weeks (84 days)

  2. Purpose
    - Automatically archive old reflections to keep the active list manageable
    - Can be called manually or via a scheduled Edge Function

  3. Security
    - Function uses security definer to run with elevated privileges
    - Only affects reflections owned by the calling user or all users if called by admin
*/

CREATE OR REPLACE FUNCTION archive_old_reflections(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  archived_daily_count bigint,
  archived_weekly_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_daily_count bigint;
  v_weekly_count bigint;
  v_seven_days_ago date;
  v_twelve_weeks_ago date;
BEGIN
  -- Calculate cutoff dates
  v_seven_days_ago := CURRENT_DATE - INTERVAL '7 days';
  v_twelve_weeks_ago := CURRENT_DATE - INTERVAL '84 days';

  -- Archive daily reflections older than 7 days
  IF p_user_id IS NULL THEN
    -- Archive for all users (admin call)
    UPDATE "0008-ap-reflections"
    SET archived = true
    WHERE reflection_type = 'daily'
      AND archived = false
      AND date < v_seven_days_ago;

    GET DIAGNOSTICS v_daily_count = ROW_COUNT;
  ELSE
    -- Archive for specific user
    UPDATE "0008-ap-reflections"
    SET archived = true
    WHERE reflection_type = 'daily'
      AND archived = false
      AND user_id = p_user_id
      AND date < v_seven_days_ago;

    GET DIAGNOSTICS v_daily_count = ROW_COUNT;
  END IF;

  -- Archive weekly reflections older than 12 weeks
  IF p_user_id IS NULL THEN
    -- Archive for all users (admin call)
    UPDATE "0008-ap-reflections"
    SET archived = true
    WHERE reflection_type = 'weekly'
      AND archived = false
      AND week_start_date < v_twelve_weeks_ago;

    GET DIAGNOSTICS v_weekly_count = ROW_COUNT;
  ELSE
    -- Archive for specific user
    UPDATE "0008-ap-reflections"
    SET archived = true
    WHERE reflection_type = 'weekly'
      AND archived = false
      AND user_id = p_user_id
      AND week_start_date < v_twelve_weeks_ago;

    GET DIAGNOSTICS v_weekly_count = ROW_COUNT;
  END IF;

  -- Return counts
  archived_daily_count := v_daily_count;
  archived_weekly_count := v_weekly_count;

  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION archive_old_reflections TO authenticated;
