/*
  Migration: User Cycles — fixed math, stable view signatures, flexible custom timelines

  What this does
  --------------
  - Allows flexible durations for custom timelines (keeps single active global)
  - Adds/keeps timeline_type (cycle/project/challenge/custom)
  - Recreates RPC ap_create_user_cycle (SECURITY DEFINER)
  - Replaces views with integer day math (no EXTRACT(EPOCH ...))
  - Pins view column order to match prior dependencies
  - Grants & indexes (idempotent)
*/

-- =========================
-- 1) Constraints & Columns
-- =========================

-- Allow flexible durations for custom cycles; drop legacy 12-week constraint if present
ALTER TABLE "0008-ap-user-cycles"
  DROP CONSTRAINT IF EXISTS ap_uc_12wk_len_chk;

ALTER TABLE "0008-ap-user-cycles"
  DROP CONSTRAINT IF EXISTS ap_uc_flexible_duration_chk;

ALTER TABLE "0008-ap-user-cycles"
  ADD CONSTRAINT ap_uc_flexible_duration_chk
  CHECK (
    (source = 'global' AND global_cycle_id IS NOT NULL AND start_date IS NULL AND end_date IS NULL)
    OR
    (source = 'custom' AND global_cycle_id IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL AND end_date > start_date)
  );

-- Add timeline_type if missing
ALTER TABLE "0008-ap-user-cycles"
  ADD COLUMN IF NOT EXISTS timeline_type text DEFAULT 'cycle'
  CHECK (timeline_type IN ('cycle','project','challenge','custom'));

-- Ensure only one active GLOBAL cycle per user (customs can be many)
DROP INDEX IF EXISTS ap_user_cycles_one_active_idx;
DROP INDEX IF EXISTS ux_user_cycle_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_cycle_one_active_global
  ON "0008-ap-user-cycles" (user_id)
  WHERE (status = 'active' AND source = 'global');

-- =========================
-- 2) RPC: create user cycle
-- =========================
DROP FUNCTION IF EXISTS ap_create_user_cycle(text, date, date, uuid, text, text, text);

CREATE OR REPLACE FUNCTION ap_create_user_cycle(
  p_source         text,
  p_start_date     date DEFAULT NULL,
  p_end_date       date DEFAULT NULL,
  p_global_cycle_id uuid DEFAULT NULL,
  p_title          text DEFAULT NULL,
  p_week_start_day text DEFAULT 'monday',
  p_timeline_type  text DEFAULT 'cycle'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_start_date date;
  v_end_date   date;
  v_title      text;
  v_user_cycle_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_week_start_day NOT IN ('sunday','monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  IF p_timeline_type NOT IN ('cycle','project','challenge','custom') THEN
    RAISE EXCEPTION 'Invalid timeline_type. Must be cycle, project, challenge, or custom';
  END IF;

  IF p_source = 'custom' THEN
    IF p_start_date IS NULL OR p_end_date IS NULL THEN
      RAISE EXCEPTION 'Start date and end date are required for custom timelines';
    END IF;
    IF p_end_date <= p_start_date THEN
      RAISE EXCEPTION 'End date must be after start date';
    END IF;

    v_start_date := p_start_date;
    v_end_date   := p_end_date;
    v_title      := COALESCE(p_title, 'Custom Timeline');

    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, title, start_date, end_date, status, week_start_day, timezone, timeline_type
    ) VALUES (
      v_user_id, 'custom', v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC', p_timeline_type
    )
    RETURNING id INTO v_user_cycle_id;

  ELSIF p_source = 'global' THEN
    -- Only one active global cycle per user
    UPDATE "0008-ap-user-cycles"
      SET status = 'completed', updated_at = now()
      WHERE user_id = v_user_id AND status = 'active' AND source = 'global';

    IF p_global_cycle_id IS NULL THEN
      RAISE EXCEPTION 'Global cycle ID is required for global cycles';
    END IF;

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
    )
    RETURNING id INTO v_user_cycle_id;

  ELSE
    RAISE EXCEPTION 'Invalid source. Must be custom or global';
  END IF;

  RETURN v_user_cycle_id;
END;
$$;

-- ================
-- 3) Views (fixed)
-- ================

-- Pin column list & order to avoid signature changes for dependents
DROP VIEW IF EXISTS v_user_cycle_weeks CASCADE;
CREATE VIEW v_user_cycle_weeks
(user_cycle_id, week_number, user_id, week_start_day, source, timeline_type, start_date, end_date)
AS
SELECT
  uc.id                                              AS user_cycle_id,
  gs.week_number                                     AS week_number,
  uc.user_id                                         AS user_id,
  uc.week_start_day                                  AS week_start_day,
  uc.source                                          AS source,
  uc.timeline_type                                   AS timeline_type,
  CASE
    WHEN uc.week_start_day = 'sunday' THEN
      (b.base_day::date - (EXTRACT(DOW FROM b.base_day)::int) * INTERVAL '1 day')::date
    ELSE
      (b.base_day::date - ((EXTRACT(DOW FROM b.base_day)::int + 6) % 7) * INTERVAL '1 day')::date
  END                                                AS start_date,
  CASE
    WHEN uc.week_start_day = 'sunday' THEN
      ((b.base_day::date - (EXTRACT(DOW FROM b.base_day)::int) * INTERVAL '1 day') + INTERVAL '6 days')::date
    ELSE
      ((b.base_day::date - ((EXTRACT(DOW FROM b.base_day)::int + 6) % 7) * INTERVAL '1 day') + INTERVAL '6 days')::date
  END                                                AS end_date
FROM "0008-ap-user-cycles" uc
CROSS JOIN LATERAL (
  -- global cycles always 12 weeks; custom cycles = ceil(inclusive_days / 7)
  SELECT generate_series(
           1,
           CASE
             WHEN uc.source = 'global' THEN 12
             ELSE CEIL(((uc.end_date - uc.start_date + 1)::numeric) / 7)::int
           END
         ) AS week_number
) gs
CROSS JOIN LATERAL (
  -- step forward in 7-day increments from cycle start
  SELECT (uc.start_date + ((gs.week_number - 1) * 7) * INTERVAL '1 day') AS base_day
) b
WHERE uc.status = 'active';

DROP VIEW IF EXISTS v_user_cycle_days_left CASCADE;
CREATE VIEW v_user_cycle_days_left
(user_cycle_id, user_id, source, timeline_type, days_left, pct_elapsed)
AS
SELECT 
  uc.id                                       AS user_cycle_id,
  uc.user_id                                  AS user_id,
  uc.source                                   AS source,
  uc.timeline_type                             AS timeline_type,
  GREATEST(0, (uc.end_date - CURRENT_DATE)::int) AS days_left,
  CASE 
    WHEN uc.end_date <= uc.start_date THEN 100
    ELSE LEAST(
      100,
      GREATEST(
        0,
        ((CURRENT_DATE - uc.start_date)::numeric / NULLIF((uc.end_date - uc.start_date)::numeric, 0)) * 100
      )
    )
  END                                         AS pct_elapsed
FROM "0008-ap-user-cycles" uc
WHERE uc.status = 'active';

-- ============================
-- 4) Grants & Function grants
-- ============================
GRANT SELECT ON v_user_cycle_weeks      TO authenticated;
GRANT SELECT ON v_user_cycle_days_left  TO authenticated;
GRANT EXECUTE ON FUNCTION ap_create_user_cycle(text, date, date, uuid, text, text, text) TO authenticated;

-- ============
-- 5) Indexes
-- ============
CREATE INDEX IF NOT EXISTS idx_user_cycles_timeline_type ON "0008-ap-user-cycles"(timeline_type);
CREATE INDEX IF NOT EXISTS idx_user_cycles_source_status ON "0008-ap-user-cycles"(source, status);
