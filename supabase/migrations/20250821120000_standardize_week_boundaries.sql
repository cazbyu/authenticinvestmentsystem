-- Standardize week boundary naming to start_date/end_date

-- Rename columns in user cycles table
ALTER TABLE "0008-ap-user-cycles"
  RENAME COLUMN IF EXISTS week_start TO start_date;
ALTER TABLE "0008-ap-user-cycles"
  RENAME COLUMN IF EXISTS week_end TO end_date;

-- Rename columns in global cycles table
ALTER TABLE "0008-ap-global-cycles"
  RENAME COLUMN IF EXISTS week_start TO start_date;
ALTER TABLE "0008-ap-global-cycles"
  RENAME COLUMN IF EXISTS week_end TO end_date;

-- Recreate v_user_cycle_weeks view with new column names
DROP VIEW IF EXISTS v_user_cycle_weeks;
CREATE VIEW v_user_cycle_weeks AS
  SELECT
    uc.id AS user_cycle_id,
    gs::date AS start_date,
    (gs + interval '6 days')::date AS end_date
  FROM "0008-ap-user-cycles" uc
  CROSS JOIN generate_series(uc.start_date, uc.end_date, interval '1 week') AS gs;

-- Recreate v_user_cycle_days_left view using standardized names
DROP VIEW IF EXISTS v_user_cycle_days_left;
CREATE VIEW v_user_cycle_days_left AS
  SELECT
    uc.id AS user_cycle_id,
    uc.user_id,
    uc.start_date,
    uc.end_date,
    GREATEST(0, uc.end_date - CURRENT_DATE) AS days_left
  FROM "0008-ap-user-cycles" uc;
