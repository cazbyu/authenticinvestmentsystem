/*
  # Align v_unified_goals timeline aliasing

  Ensures all goal timelines expose a common `timeline_id` column
  so client hooks can filter goals regardless of the originating
  timeline table/column.
*/

CREATE OR REPLACE VIEW v_unified_goals AS
SELECT
  g.id,
  g.user_id,
  g.title,
  g.description,
  g.status,
  g.progress,
  g.weekly_target,
  g.total_target,
  g.start_date,
  g.end_date,
  g.created_at,
  g.updated_at,
  g.user_global_timeline_id AS timeline_id,
  'global'::text AS source
FROM "0008-ap-goals-12wk" g
WHERE g.user_global_timeline_id IS NOT NULL
UNION ALL
SELECT
  g.id,
  g.user_id,
  g.title,
  g.description,
  g.status,
  g.progress,
  g.weekly_target,
  g.total_target,
  g.start_date,
  g.end_date,
  g.created_at,
  g.updated_at,
  g.custom_timeline_id AS timeline_id,
  'global'::text AS source
FROM "0008-ap-goals-12wk" g
WHERE g.user_global_timeline_id IS NULL
UNION ALL
SELECT
  c.id,
  c.user_id,
  c.title,
  c.description,
  c.status,
  c.progress,
  NULL::integer AS weekly_target,
  NULL::integer AS total_target,
  c.start_date,
  c.end_date,
  c.created_at,
  c.updated_at,
  c.custom_timeline_id AS timeline_id,
  'custom'::text AS source
FROM "0008-ap-goals-custom" c;

GRANT SELECT ON v_unified_goals TO authenticated;
