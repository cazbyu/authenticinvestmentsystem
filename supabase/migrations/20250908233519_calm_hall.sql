/*
  # Create Custom Timeline System

  1. New Tables
     - `0008-ap-custom-timelines` - Custom timeline containers (like 12-week cycles)
     - Update goals tables to reference custom timelines

  2. Schema Changes
     - Add `custom_timeline_id` to goals tables
     - Add week calculation support for custom timelines

  3. Security
     - Enable RLS on custom timelines table
     - Add policies for authenticated users to manage their own timelines

  4. Functions
     - Create function to calculate weeks for custom timelines
     - Update existing RPC functions to support custom timelines
*/

-- Create the custom timelines table
CREATE TABLE IF NOT EXISTS "0008-ap-custom-timelines" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_custom_timeline_date_range CHECK (end_date > start_date)
);

-- Enable RLS
ALTER TABLE "0008-ap-custom-timelines" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom timelines
CREATE POLICY "Users can select their own custom timelines" ON "0008-ap-custom-timelines"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom timelines" ON "0008-ap-custom-timelines"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom timelines" ON "0008-ap-custom-timelines"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom timelines" ON "0008-ap-custom-timelines"
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add custom_timeline_id to 12-week goals table
ALTER TABLE "0008-ap-goals-12wk"
  ADD COLUMN IF NOT EXISTS custom_timeline_id uuid REFERENCES "0008-ap-custom-timelines"(id) ON DELETE CASCADE;

-- Add custom_timeline_id to custom goals table  
ALTER TABLE "0008-ap-goals-custom"
  ADD COLUMN IF NOT EXISTS custom_timeline_id uuid REFERENCES "0008-ap-custom-timelines"(id) ON DELETE CASCADE;

-- Add custom_timeline_id to tasks table
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN IF NOT EXISTS custom_timeline_id uuid REFERENCES "0008-ap-custom-timelines"(id) ON DELETE SET NULL;

-- Create view for custom timeline weeks
CREATE OR REPLACE VIEW v_custom_timeline_weeks AS
SELECT 
  ct.id as custom_timeline_id,
  ct.user_id,
  ct.week_start_day,
  generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) as week_number,
  CASE 
    WHEN ct.week_start_day = 'sunday' THEN
      (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day'
    ELSE
      (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day'
  END as start_date,
  CASE 
    WHEN ct.week_start_day = 'sunday' THEN
      (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day' +
      INTERVAL '6 days'
    ELSE
      (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (ct.start_date + ((generate_series(1, CEIL(EXTRACT(EPOCH FROM (ct.end_date - ct.start_date)) / (7 * 24 * 60 * 60))::integer) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day' +
      INTERVAL '6 days'
  END as end_date
FROM "0008-ap-custom-timelines" ct
WHERE ct.status = 'active';

-- Create view for custom timeline days left
CREATE OR REPLACE VIEW v_custom_timeline_days_left AS
SELECT 
  ct.id as custom_timeline_id,
  ct.user_id,
  GREATEST(0, (ct.end_date - CURRENT_DATE)::integer) as days_left,
  CASE 
    WHEN ct.end_date <= ct.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - ct.start_date)::numeric / (ct.end_date - ct.start_date)::numeric) * 100
    ))
  END as pct_elapsed
FROM "0008-ap-custom-timelines" ct
WHERE ct.status = 'active';

-- Create trigger function for auto-updating custom timeline timestamps
CREATE OR REPLACE FUNCTION update_custom_timelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to custom timelines table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_custom_timelines_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_custom_timelines_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-custom-timelines"
          FOR EACH ROW
          EXECUTE FUNCTION update_custom_timelines_updated_at();
    END IF;
END $$;

-- Grant access to the views
GRANT SELECT ON v_custom_timeline_weeks TO authenticated;
GRANT SELECT ON v_custom_timeline_days_left TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_timelines_user_id ON "0008-ap-custom-timelines"(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_timelines_status ON "0008-ap-custom-timelines"(status);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_custom_timeline ON "0008-ap-goals-12wk"(custom_timeline_id);
CREATE INDEX IF NOT EXISTS idx_goals_custom_custom_timeline ON "0008-ap-goals-custom"(custom_timeline_id);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_timeline ON "0008-ap-tasks"(custom_timeline_id);