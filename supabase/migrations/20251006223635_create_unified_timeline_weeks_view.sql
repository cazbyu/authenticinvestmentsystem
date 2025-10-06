/*
  # Create Unified Timeline Weeks View

  ## Summary
  Creates a unified view that currently only includes global timelines.
  Custom timelines support can be added later when the custom timeline views are created.

  ## Changes Made
  1. **v_unified_timeline_weeks**: Unified view for all timeline types
  2. **v_unified_timeline_days_left**: Unified view for days remaining calculations
*/

-- Create unified timeline weeks view (currently only global timelines)
CREATE OR REPLACE VIEW v_unified_timeline_weeks AS
SELECT 
  timeline_id,
  week_number,
  week_start,
  week_end,
  'global'::text AS source
FROM v_user_global_timeline_weeks;

-- Create view for days left calculation
CREATE OR REPLACE VIEW v_unified_timeline_days_left AS
SELECT 
  ugt.id as timeline_id,
  GREATEST(0, (gc.end_date - CURRENT_DATE)::integer) as days_left,
  CASE 
    WHEN gc.end_date <= gc.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - gc.start_date)::numeric / (gc.end_date - gc.start_date)::numeric) * 100
    ))
  END as pct_elapsed,
  'global'::text AS source
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.status = 'active';

-- Grant access
GRANT SELECT ON v_unified_timeline_weeks TO authenticated;
GRANT SELECT ON v_unified_timeline_days_left TO authenticated;

COMMENT ON VIEW v_unified_timeline_weeks IS 'Unified view of all timeline weeks from global timelines';
COMMENT ON VIEW v_unified_timeline_days_left IS 'Unified view of days remaining for all active timelines';
