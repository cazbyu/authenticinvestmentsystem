/*
  # Create User Cycle Management System

  1. New Tables
     - `0008-ap-user-cycles` - User-specific 12-week cycles
     - `0008-ap-task-week-plan` - Weekly targets for tasks
     - `0008-ap-task-log` - Daily completion tracking

  2. Views
     - `v_user_cycle_weeks` - Week windows respecting week start day
     - `v_user_cycle_days_left` - Days remaining calculation

  3. RPC Functions
     - `ap_create_user_cycle` - Create custom or global-synced cycles
     - `ap_toggle_task_day` - Toggle daily task completion

  4. Security
     - Enable RLS on all tables
     - Add policies for authenticated users to manage their own data
*/

-- Create the user cycles table
CREATE TABLE IF NOT EXISTS "0008-ap-user-cycles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('custom', 'global')),
  global_cycle_id uuid REFERENCES "0008-ap-global-cycles"(id) ON DELETE SET NULL,
  title text,
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  week_start_day text DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create the task week plan table
CREATE TABLE IF NOT EXISTS "0008-ap-task-week-plan" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  user_cycle_id uuid NOT NULL REFERENCES "0008-ap-user-cycles"(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  target_days integer NOT NULL DEFAULT 1 CHECK (target_days >= 0 AND target_days <= 7),
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_cycle_id, week_number)
);

-- Create the task log table
CREATE TABLE IF NOT EXISTS "0008-ap-task-log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, log_date)
);

-- Enable RLS
ALTER TABLE "0008-ap-user-cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-task-week-plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-task-log" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user cycles
CREATE POLICY "Users can select their own cycles" ON "0008-ap-user-cycles"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cycles" ON "0008-ap-user-cycles"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cycles" ON "0008-ap-user-cycles"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cycles" ON "0008-ap-user-cycles"
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for task week plans
CREATE POLICY "Users can select their own task week plans" ON "0008-ap-task-week-plan"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-user-cycles" uc 
      WHERE uc.id = user_cycle_id AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own task week plans" ON "0008-ap-task-week-plan"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0008-ap-user-cycles" uc 
      WHERE uc.id = user_cycle_id AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own task week plans" ON "0008-ap-task-week-plan"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-user-cycles" uc 
      WHERE uc.id = user_cycle_id AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own task week plans" ON "0008-ap-task-week-plan"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-user-cycles" uc 
      WHERE uc.id = user_cycle_id AND uc.user_id = auth.uid()
    )
  );

-- RLS Policies for task logs
CREATE POLICY "Users can select their own task logs" ON "0008-ap-task-log"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own task logs" ON "0008-ap-task-log"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own task logs" ON "0008-ap-task-log"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own task logs" ON "0008-ap-task-log"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

-- Add user_cycle_id column to tasks table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'user_cycle_id'
  ) THEN
    ALTER TABLE "0008-ap-tasks" ADD COLUMN user_cycle_id uuid REFERENCES "0008-ap-user-cycles"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tasks_user_cycle_id ON "0008-ap-tasks"(user_cycle_id);
  END IF;
END $$;

-- Add input_kind and unit columns to tasks table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'input_kind'
  ) THEN
    ALTER TABLE "0008-ap-tasks" ADD COLUMN input_kind text DEFAULT 'boolean' CHECK (input_kind IN ('boolean', 'count', 'duration'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'unit'
  ) THEN
    ALTER TABLE "0008-ap-tasks" ADD COLUMN unit text DEFAULT 'completion' CHECK (unit IN ('completion', 'days', 'hours', 'minutes'));
  END IF;
END $$;

-- Create the user cycle creation RPC function
CREATE OR REPLACE FUNCTION ap_create_user_cycle(
  p_source text,
  p_start_date date DEFAULT NULL,
  p_global_cycle_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_week_start_day text DEFAULT 'monday'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_start_date date;
  v_end_date date;
  v_title text;
  v_user_cycle_id uuid;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day parameter
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Deactivate any existing active cycles for this user
  UPDATE "0008-ap-user-cycles"
  SET status = 'completed', updated_at = now()
  WHERE user_id = v_user_id AND status = 'active';

  IF p_source = 'custom' THEN
    -- Custom cycle
    IF p_start_date IS NULL THEN
      RAISE EXCEPTION 'Start date is required for custom cycles';
    END IF;
    
    v_start_date := p_start_date;
    v_end_date := p_start_date + INTERVAL '83 days'; -- 12 weeks minus 1 day
    v_title := COALESCE(p_title, 'Custom 12-Week Cycle');
    
    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, title, start_date, end_date, status, week_start_day, timezone
    ) VALUES (
      v_user_id, 'custom', v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC'
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSIF p_source = 'global' THEN
    -- Global cycle sync
    IF p_global_cycle_id IS NULL THEN
      RAISE EXCEPTION 'Global cycle ID is required for global cycles';
    END IF;
    
    -- Get global cycle data
    SELECT start_date, end_date, title
    INTO v_start_date, v_end_date, v_title
    FROM "0008-ap-global-cycles"
    WHERE id = p_global_cycle_id AND is_active = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Global cycle not found or not active';
    END IF;
    
    INSERT INTO "0008-ap-user-cycles" (
      user_id, source, global_cycle_id, title, start_date, end_date, status, week_start_day, timezone
    ) VALUES (
      v_user_id, 'global', p_global_cycle_id, v_title, v_start_date, v_end_date, 'active', p_week_start_day, 'UTC'
    ) RETURNING id INTO v_user_cycle_id;
    
  ELSE
    RAISE EXCEPTION 'Invalid source. Must be custom or global';
  END IF;

  RETURN v_user_cycle_id;
END;
$$;

-- Create the view for user cycle weeks that respects week start day
CREATE OR REPLACE VIEW v_user_cycle_weeks AS
SELECT 
  uc.id as user_cycle_id,
  uc.user_id,
  uc.week_start_day,
  generate_series(1, 12) as week_number,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day'
    ELSE
      -- Monday-anchored weeks  
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day'
  END as starts_on,
  CASE 
    WHEN uc.week_start_day = 'sunday' THEN
      -- Sunday-anchored weeks (end on Saturday)
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date)::integer * INTERVAL '1 day' +
      INTERVAL '6 days'
    ELSE
      -- Monday-anchored weeks (end on Sunday)
      (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date -
      (EXTRACT(DOW FROM (uc.start_date + ((generate_series(1, 12) - 1) * INTERVAL '7 days'))::date) + 6)::integer % 7 * INTERVAL '1 day' +
      INTERVAL '6 days'
  END as ends_on
FROM "0008-ap-user-cycles" uc
WHERE uc.status = 'active';

-- Create the view for days left calculation
CREATE OR REPLACE VIEW v_user_cycle_days_left AS
SELECT 
  uc.id as user_cycle_id,
  uc.user_id,
  GREATEST(0, (uc.end_date - CURRENT_DATE)::integer) as days_left,
  CASE 
    WHEN uc.end_date <= uc.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - uc.start_date)::numeric / (uc.end_date - uc.start_date)::numeric) * 100
    ))
  END as pct_elapsed
FROM "0008-ap-user-cycles" uc
WHERE uc.status = 'active';

-- Create the task day toggle RPC function
CREATE OR REPLACE FUNCTION ap_toggle_task_day(
  p_task_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_completed boolean;
  v_new_completed boolean;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify the task belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM "0008-ap-tasks" 
    WHERE id = p_task_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Task not found or access denied';
  END IF;

  -- Get current completion status
  SELECT completed INTO v_current_completed
  FROM "0008-ap-task-log"
  WHERE task_id = p_task_id AND log_date = p_date;

  -- If no log exists, create one with completed = true
  IF NOT FOUND THEN
    INSERT INTO "0008-ap-task-log" (task_id, log_date, completed)
    VALUES (p_task_id, p_date, true);
    v_new_completed := true;
  ELSE
    -- Toggle the existing log
    v_new_completed := NOT v_current_completed;
    UPDATE "0008-ap-task-log"
    SET completed = v_new_completed
    WHERE task_id = p_task_id AND log_date = p_date;
  END IF;

  RETURN v_new_completed;
END;
$$;

-- Grant access to the views and functions
GRANT SELECT ON v_user_cycle_weeks TO authenticated;
GRANT SELECT ON v_user_cycle_days_left TO authenticated;
GRANT EXECUTE ON FUNCTION ap_create_user_cycle TO authenticated;
GRANT EXECUTE ON FUNCTION ap_toggle_task_day TO authenticated;

-- Create trigger functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_user_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_user_cycles_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_user_cycles_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-user-cycles"
          FOR EACH ROW
          EXECUTE FUNCTION update_user_cycles_updated_at();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_cycles_user_id ON "0008-ap-user-cycles"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cycles_status ON "0008-ap-user-cycles"(status);
CREATE INDEX IF NOT EXISTS idx_user_cycles_global_cycle ON "0008-ap-user-cycles"(global_cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_task_id ON "0008-ap-task-week-plan"(task_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_user_cycle ON "0008-ap-task-week-plan"(user_cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_log_task_id ON "0008-ap-task-log"(task_id);
CREATE INDEX IF NOT EXISTS idx_task_log_date ON "0008-ap-task-log"(log_date);