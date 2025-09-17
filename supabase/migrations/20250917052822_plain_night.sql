/*
  # Create Unified Timeline Views

  1. New Views
     - `v_unified_timeline_weeks` - Combines global and custom timeline weeks
     - `v_unified_timeline_days_left` - Combines global and custom timeline days left

  2. Purpose
     - Provides consistent interface for querying timeline data
     - Handles both global and custom timelines in a single view
     - Includes source column to distinguish between timeline types
*/

-- Create unified timeline weeks view
CREATE OR REPLACE VIEW v_unified_timeline_weeks AS
SELECT 
  timeline_id,
  user_id,
  week_number,
  week_start,
  week_end,
  'global'::text AS source
FROM v_user_global_timeline_weeks

UNION ALL

SELECT 
  custom_timeline_id AS timeline_id,
  user_id,
  week_number,
  start_date AS week_start,
  end_date AS week_end,
  'custom'::text AS source
FROM v_custom_timeline_weeks;

-- Create unified timeline days left view
CREATE OR REPLACE VIEW v_unified_timeline_days_left AS
SELECT 
  user_global_timeline_id AS timeline_id,
  user_id,
  days_left,
  pct_elapsed,
  'global'::text AS source
FROM v_user_global_timeline_days_left

UNION ALL

SELECT 
  custom_timeline_id AS timeline_id,
  user_id,
  days_left,
  pct_elapsed,
  'custom'::text AS source
FROM v_custom_timeline_days_left;

-- Grant access to the views
GRANT SELECT ON v_unified_timeline_weeks TO authenticated;
GRANT SELECT ON v_unified_timeline_days_left TO authenticated;