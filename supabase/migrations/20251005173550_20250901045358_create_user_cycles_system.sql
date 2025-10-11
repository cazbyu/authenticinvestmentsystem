/*
  # Create User Cycle Management System

  1. New Tables
     - `0008-ap-user-cycles` - User-specific 12-week cycles
     - `0008-ap-task-week-plan` - Weekly targets for tasks
     - `0008-ap-task-log` - Daily completion tracking (DEPRECATED - using parent_task_id instead)

  2. Security
     - Enable RLS on all tables
     - Policies for users to manage their own data

  3. Notes
     - User cycles can be custom or synced to global cycles
     - Task week plan tracks action frequency per week
*/

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

CREATE TABLE IF NOT EXISTS "0008-ap-task-week-plan" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  user_cycle_id uuid REFERENCES "0008-ap-user-cycles"(id) ON DELETE CASCADE,
  user_global_timeline_id uuid,
  user_custom_timeline_id uuid,
  week_number integer NOT NULL CHECK (week_number >= 1),
  target_days integer NOT NULL DEFAULT 1 CHECK (target_days >= 0 AND target_days <= 7),
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_cycle_id, week_number),
  UNIQUE(task_id, user_global_timeline_id, week_number),
  UNIQUE(task_id, user_custom_timeline_id, week_number)
);

ALTER TABLE "0008-ap-user-cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-task-week-plan" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own cycles" ON "0008-ap-user-cycles"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cycles" ON "0008-ap-user-cycles"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cycles" ON "0008-ap-user-cycles"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cycles" ON "0008-ap-user-cycles"
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own task week plans" ON "0008-ap-task-week-plan"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert their own task week plans" ON "0008-ap-task-week-plan"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update their own task week plans" ON "0008-ap-task-week-plan"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete their own task week plans" ON "0008-ap-task-week-plan"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-tasks" t 
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_cycles_user_id ON "0008-ap-user-cycles"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cycles_global_cycle ON "0008-ap-user-cycles"(global_cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_task_id ON "0008-ap-task-week-plan"(task_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_user_cycle ON "0008-ap-task-week-plan"(user_cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_user_global_timeline ON "0008-ap-task-week-plan"(user_global_timeline_id);
CREATE INDEX IF NOT EXISTS idx_task_week_plan_user_custom_timeline ON "0008-ap-task-week-plan"(user_custom_timeline_id);
