/*
  # Create Global Timeline System

  1. New Tables
     - `0008-ap-user-global-timelines` - User-linked global cycles

  2. Schema
     - `id` (uuid, primary key)
     - `user_id` (uuid, references auth.users)
     - `global_cycle_id` (uuid, references 0008-ap-global-cycles)
     - `title` (text, optional override)
     - `description` (text, optional)
     - `start_date` (date, inherited from global cycle)
     - `end_date` (date, inherited from global cycle)
     - `status` (text, default 'active')
     - `week_start_day` (text, default 'monday')
     - `timezone` (text, default 'UTC')
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  3. Security
     - Enable RLS on user global timelines table
     - Add policies for users to manage their own global timeline links

  4. Triggers
     - Auto-update timestamps
*/

-- Create the user global timelines table
CREATE TABLE IF NOT EXISTS "0008-ap-user-global-timelines" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_cycle_id uuid NOT NULL REFERENCES "0008-ap-global-cycles"(id) ON DELETE CASCADE,
  title text,
  description text,
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_cycle_id)
);

-- Enable RLS
ALTER TABLE "0008-ap-user-global-timelines" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user global timelines
CREATE POLICY "Users can select their own global timelines" ON "0008-ap-user-global-timelines"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own global timelines" ON "0008-ap-user-global-timelines"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own global timelines" ON "0008-ap-user-global-timelines"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own global timelines" ON "0008-ap-user-global-timelines"
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_user_global_timelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to user global timelines table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_user_global_timelines_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_user_global_timelines_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-user-global-timelines"
          FOR EACH ROW
          EXECUTE FUNCTION update_user_global_timelines_updated_at();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_user_id ON "0008-ap-user-global-timelines"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_status ON "0008-ap-user-global-timelines"(status);
CREATE INDEX IF NOT EXISTS idx_user_global_timelines_global_cycle ON "0008-ap-user-global-timelines"(global_cycle_id);

-- Create view for user global timeline weeks
CREATE OR REPLACE VIEW v_user_global_timeline_weeks AS
SELECT 
  ugt.id as user_global_timeline_id,
  ugt.user_id,
  ugt.week_start_day,
  generate_series(1, 12) as week_number,
  CASE 
    WHEN ugt.week_start_day = 'sunday' THEN
      (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day'
    ELSE
      (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day'
  END as week_start,
  CASE 
    WHEN ugt.week_start_day = 'sunday' THEN
      (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day' +
      INTERVAL '6 days'
    ELSE
      (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (ugt.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day' +
      INTERVAL '6 days'
  END as week_end
FROM "0008-ap-user-global-timelines" ugt
WHERE ugt.status = 'active';

-- Create view for global timeline days left
CREATE OR REPLACE VIEW v_user_global_timeline_days_left AS
SELECT 
  ugt.id as user_global_timeline_id,
  ugt.user_id,
  GREATEST(0, (ugt.end_date - CURRENT_DATE)::integer) as days_left,
  CASE 
    WHEN ugt.end_date <= ugt.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - ugt.start_date)::numeric / (ugt.end_date - ugt.start_date)::numeric) * 100
    ))
  END as pct_elapsed
FROM "0008-ap-user-global-timelines" ugt
WHERE ugt.status = 'active';

-- Grant access to the views
GRANT SELECT ON v_user_global_timeline_weeks TO authenticated;
GRANT SELECT ON v_user_global_timeline_days_left TO authenticated;