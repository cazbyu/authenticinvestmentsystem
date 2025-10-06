/*
  # Fix Global Timeline Weeks View

  ## Summary
  Fixes the v_user_global_timeline_weeks view to properly join with the global_cycles table
  and calculate week boundaries correctly based on the cycle's actual start_date.

  ## Changes Made
  1. **Join with global_cycles table**: Get start_date and week_start_day from the global cycle
  2. **Simplified week calculation**: Calculate weeks directly from the cycle start date
  3. **Proper week boundaries**: Ensure weeks align with the actual cycle start date
  4. **Add timeline_id alias**: Map user_global_timeline_id to timeline_id for consistency

  ## Important
  This view generates 12 weeks starting from the global cycle's start_date.
  Week 1 should start on the cycle's start_date (or adjusted for Monday if needed).
*/

-- Recreate the view with proper joins and corrected logic
CREATE OR REPLACE VIEW v_user_global_timeline_weeks AS
SELECT 
  ugt.id as timeline_id,
  ugt.user_id,
  gc.week_start_day,
  week_series.week_number,
  -- Calculate week start: cycle start + (week_number - 1) * 7 days
  (gc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days'))::date as week_start,
  -- Calculate week end: week_start + 6 days
  (gc.start_date + ((week_series.week_number - 1) * INTERVAL '7 days') + INTERVAL '6 days')::date as week_end
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
CROSS JOIN LATERAL generate_series(1, 12) as week_series(week_number)
WHERE ugt.status = 'active';

-- Grant access to authenticated users
GRANT SELECT ON v_user_global_timeline_weeks TO authenticated;

-- Verify the view works correctly
COMMENT ON VIEW v_user_global_timeline_weeks IS 'Generates 12 weeks for each active user global timeline, starting from the global cycle start date';
