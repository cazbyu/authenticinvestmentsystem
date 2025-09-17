/*
  # Create Unified Timeline Views (Final - Corrected)

  Both global and custom views use:
  - timeline_id
  - week_number
  - week_start
  - week_end
*/

-- Unified timeline weeks view
CREATE OR REPLACE VIEW v_unified_timeline_weeks AS
SELECT 
  timeline_id,
  week_number,
  week_start,
  week_end,
  'global'::text AS source
FROM v_user_global_timeline_weeks

UNION ALL

SELECT 
  timeline_id,
  week_number,
  week_start,
  week_end,
  'custom'::text AS source
FROM v_custom_timeline_weeks;

-- Unified timeline days left view
CREATE OR REPLACE VIEW v_unified_timeline_days_left AS
SELECT 
  timeline_id,
  days_left,
  pct_elapsed,
  'global'::text AS source
FROM v_user_global_timeline_days_left

UNION ALL

SELECT 
  timeline_id,
  days_left,
  pct_elapsed,
  'custom'::text AS source
FROM v_custom_timeline_days_left;

-- Grant access
GRANT SELECT ON v_unified_timeline_weeks TO authenticated;
GRANT SELECT ON v_unified_timeline_days_left TO authenticated;