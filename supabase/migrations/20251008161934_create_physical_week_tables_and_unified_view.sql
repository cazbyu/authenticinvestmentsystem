/*
  # Create Physical Week Tables for Global and Custom Timelines

  ## Changes

  1. **Create 0008-ap-global-weeks Table**
    - Physical table to store pre-calculated global cycle weeks
    - Referenced by existing generate_global_weeks() function but never created
    - Unique constraint on (global_cycle_id, week_number)

  2. **Create 0008-ap-custom-weeks Table**
    - Physical table to store pre-calculated custom timeline weeks
    - Referenced by existing generate_custom_weeks() function but never created
    - Unique constraint on (custom_timeline_id, week_number)

  3. **Backfill Week Data**
    - Populate global weeks from all existing global timelines
    - Populate custom weeks from all existing active custom timelines

  4. **Update v_custom_timeline_weeks View**
    - Replace generate_series() with direct reads from physical table
    - Standardize column names to week_start and week_end
    - Add source column

  5. **Enable RLS on Both Week Tables**
    - Global weeks: public read, authenticated write
    - Custom weeks: users can only access their own timeline weeks

  6. **Update v_unified_timeline_weeks View**
    - Combine global and custom timeline weeks
    - Provide single interface for all timeline weeks

  ## Performance Impact

  - Eliminates expensive generate_series() date calculations
  - Uses pre-populated indexed tables
  - Expected 10-100x performance improvement

  ## Security

  - RLS policies ensure proper data access control
  - Triggers continue to populate weeks automatically
*/

-- =====================================================
-- 1. CREATE 0008-ap-global-weeks TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "0008-ap-global-weeks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_cycle_id uuid NOT NULL REFERENCES "0008-ap-global-cycles"(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique weeks per cycle
  CONSTRAINT unique_global_cycle_week UNIQUE (global_cycle_id, week_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_weeks_cycle_id 
  ON "0008-ap-global-weeks"(global_cycle_id);

CREATE INDEX IF NOT EXISTS idx_global_weeks_dates 
  ON "0008-ap-global-weeks"(week_start, week_end);

-- =====================================================
-- 2. CREATE 0008-ap-custom-weeks TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "0008-ap-custom-weeks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_timeline_id uuid NOT NULL REFERENCES "0008-ap-custom-timelines"(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique weeks per timeline
  CONSTRAINT unique_custom_timeline_week UNIQUE (custom_timeline_id, week_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_weeks_timeline_id 
  ON "0008-ap-custom-weeks"(custom_timeline_id);

CREATE INDEX IF NOT EXISTS idx_custom_weeks_dates 
  ON "0008-ap-custom-weeks"(week_start, week_end);

-- =====================================================
-- 3. BACKFILL WEEK DATA
-- =====================================================

-- Generate weeks for all existing user global timelines
DO $$
DECLARE
  timeline_rec RECORD;
BEGIN
  FOR timeline_rec IN 
    SELECT id FROM "0008-ap-user-global-timelines"
  LOOP
    BEGIN
      PERFORM generate_global_weeks(timeline_rec.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other timelines
      RAISE NOTICE 'Failed to generate global weeks for timeline %: %', timeline_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Generate weeks for all existing active custom timelines
DO $$
DECLARE
  timeline_rec RECORD;
BEGIN
  FOR timeline_rec IN 
    SELECT id FROM "0008-ap-custom-timelines" WHERE status = 'active'
  LOOP
    BEGIN
      PERFORM generate_custom_weeks(timeline_rec.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other timelines
      RAISE NOTICE 'Failed to generate custom weeks for timeline %: %', timeline_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- 4. UPDATE v_custom_timeline_weeks VIEW
-- =====================================================

-- Drop existing view
DROP VIEW IF EXISTS v_custom_timeline_weeks CASCADE;

-- Recreate view reading from physical table
CREATE OR REPLACE VIEW v_custom_timeline_weeks AS
SELECT 
  ct.id AS custom_timeline_id,
  ct.user_id,
  ct.week_start_day,
  cw.week_number,
  cw.week_start,
  cw.week_end,
  'custom'::text AS source
FROM "0008-ap-custom-timelines" ct
JOIN "0008-ap-custom-weeks" cw ON cw.custom_timeline_id = ct.id
WHERE ct.status = 'active';

-- =====================================================
-- 5. ENABLE RLS ON BOTH WEEK TABLES
-- =====================================================

-- Global weeks RLS (mirrors existing pattern from query results)
ALTER TABLE "0008-ap-global-weeks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gw_select_all"
  ON "0008-ap-global-weeks"
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "gw_select_authenticated"
  ON "0008-ap-global-weeks"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "gw_insert_authenticated"
  ON "0008-ap-global-weeks"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "gw_update_authenticated"
  ON "0008-ap-global-weeks"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gw_delete_authenticated"
  ON "0008-ap-global-weeks"
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "gw_write_service_role"
  ON "0008-ap-global-weeks"
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Custom weeks RLS
ALTER TABLE "0008-ap-custom-weeks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cw_select_own"
  ON "0008-ap-custom-weeks"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "0008-ap-custom-timelines" ct
      WHERE ct.id = "0008-ap-custom-weeks".custom_timeline_id
        AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "cw_insert_authenticated"
  ON "0008-ap-custom-weeks"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "0008-ap-custom-timelines" ct
      WHERE ct.id = "0008-ap-custom-weeks".custom_timeline_id
        AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "cw_update_own"
  ON "0008-ap-custom-weeks"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "0008-ap-custom-timelines" ct
      WHERE ct.id = "0008-ap-custom-weeks".custom_timeline_id
        AND ct.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "0008-ap-custom-timelines" ct
      WHERE ct.id = "0008-ap-custom-weeks".custom_timeline_id
        AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "cw_delete_own"
  ON "0008-ap-custom-weeks"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "0008-ap-custom-timelines" ct
      WHERE ct.id = "0008-ap-custom-weeks".custom_timeline_id
        AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "cw_all_service_role"
  ON "0008-ap-custom-weeks"
  FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 6. UPDATE v_unified_timeline_weeks VIEW
-- =====================================================

-- Drop and recreate unified view to include both sources
DROP VIEW IF EXISTS v_unified_timeline_weeks;

CREATE OR REPLACE VIEW v_unified_timeline_weeks AS
-- Global timeline weeks
SELECT 
  utl.id AS timeline_id,
  gw.week_number,
  gw.week_start,
  gw.week_end,
  'global'::text AS source
FROM "0008-ap-user-global-timelines" utl
JOIN "0008-ap-global-weeks" gw ON gw.global_cycle_id = utl.global_cycle_id

UNION ALL

-- Custom timeline weeks
SELECT 
  ct.id AS timeline_id,
  cw.week_number,
  cw.week_start,
  cw.week_end,
  'custom'::text AS source
FROM "0008-ap-custom-timelines" ct
JOIN "0008-ap-custom-weeks" cw ON cw.custom_timeline_id = ct.id
WHERE ct.status = 'active'

ORDER BY week_start, week_number;
