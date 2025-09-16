-- Ensure v_custom_timeline_weeks exposes the expected week boundaries
CREATE OR REPLACE VIEW v_custom_timeline_weeks AS
SELECT
  ct.id AS custom_timeline_id,
  ct.user_id,
  ct.week_start_day,
  gs.week_number,
  CASE
    WHEN ct.week_start_day = 'sunday' THEN
      base_date - EXTRACT(DOW FROM base_date)::integer
    ELSE
      base_date - ((EXTRACT(DOW FROM base_date)::integer + 6) % 7)
  END AS start_date,
  CASE
    WHEN ct.week_start_day = 'sunday' THEN
      base_date - EXTRACT(DOW FROM base_date)::integer + 6
    ELSE
      base_date - ((EXTRACT(DOW FROM base_date)::integer + 6) % 7) + 6
  END AS end_date
FROM "0008-ap-custom-timelines" ct
JOIN LATERAL generate_series(
  1,
  GREATEST(
    1,
    CEIL(((ct.end_date - ct.start_date + 1)::numeric) / 7)::integer
  )
) AS gs(week_number) ON TRUE
CROSS JOIN LATERAL (
  SELECT (ct.start_date + ((gs.week_number - 1) * INTERVAL '7 days'))::date AS base_date
) AS derived
WHERE ct.status = 'active';
