/*
  # Create Unified Goals View

  This view consolidates 12-week and custom goals into a single projection for
  client consumption.
*/

DROP VIEW IF EXISTS v_unified_goals;
CREATE VIEW v_unified_goals AS
SELECT
  g12.id,
  g12.user_id,
  g12.title,
  g12.description,
  g12.status,
  g12.progress,
  g12.weekly_target,
  g12.total_target,
  g12.start_date,
  g12.end_date,
  g12.created_at,
  g12.updated_at,
  g12.timeline_id,
  NULL::uuid AS custom_timeline_id,
  'twelve_wk'::text AS source
FROM "0008-ap-goals-12wk" g12

UNION ALL

SELECT
  gc.id,
  gc.user_id,
  gc.title,
  gc.description,
  gc.status,
  gc.progress,
  NULL::integer AS weekly_target,
  NULL::integer AS total_target,
  gc.start_date,
  gc.end_date,
  gc.created_at,
  gc.updated_at,
  NULL::uuid AS timeline_id,
  gc.custom_timeline_id,
  'custom'::text AS source
FROM "0008-ap-goals-custom" gc;

GRANT SELECT ON v_unified_goals TO authenticated;
