-- Refresh custom timeline weeks view to use standardized start/end column names
DROP VIEW IF EXISTS v_unified_timeline_weeks;
DROP VIEW IF EXISTS v_custom_timeline_weeks;

CREATE VIEW v_custom_timeline_weeks AS
SELECT
  ROW_NUMBER() OVER (PARTITION BY uc.id ORDER BY week_start)::int AS week_number,
  week_start::date AS start_date,
  LEAST((week_start + interval '6 days')::date, uc.end_date) AS end_date,
  uc.id AS timeline_id,
  'custom'::text AS source
FROM "0008-ap-user-cycles" uc
CROSS JOIN generate_series(uc.start_date, uc.end_date, interval '1 week') AS week_start;

CREATE VIEW v_unified_timeline_weeks AS
SELECT
  week_number,
  start_date,
  end_date,
  timeline_id,
  source
FROM v_custom_timeline_weeks

UNION ALL

SELECT
  ROW_NUMBER() OVER (PARTITION BY gc.id ORDER BY week_start)::int AS week_number,
  week_start::date AS start_date,
  LEAST((week_start + interval '6 days')::date, gc.end_date) AS end_date,
  gc.id AS timeline_id,
  'global'::text AS source
FROM "0008-ap-global-cycles" gc
CROSS JOIN generate_series(gc.start_date, gc.end_date, interval '1 week') AS week_start;
