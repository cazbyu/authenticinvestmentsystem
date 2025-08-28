/*
  # Create 12-Week Goals System

  1. New Tables
     - `0008-ap-global-cycles` - Global 12-week cycles
     - `0008-ap-goals-12wk` - 12-week goals with targets and progress tracking

  2. Schema
     - Global cycles with start/end dates and reflection periods
     - Goals with weekly and total targets for leading/lagging indicators
     - Proper foreign key relationships and constraints

  3. Security
     - Enable RLS on all tables
     - Add policies for authenticated users to manage their own data

  4. Triggers
     - Auto-update timestamps
*/

-- Create the global cycles table
CREATE TABLE IF NOT EXISTS "0008-ap-global-cycles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  cycle_label text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reflection_start date,
  reflection_end date,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create the 12-week goals table
CREATE TABLE IF NOT EXISTS "0008-ap-goals-12wk" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_cycle_id uuid REFERENCES "0008-ap-global-cycles"(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  weekly_target integer DEFAULT 3,
  total_target integer DEFAULT 36,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "0008-ap-global-cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-goals-12wk" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for global cycles (read-only for authenticated users)
CREATE POLICY "Authenticated users can read global cycles" ON "0008-ap-global-cycles"
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for 12-week goals
CREATE POLICY "Users can select their own 12-week goals" ON "0008-ap-goals-12wk"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 12-week goals" ON "0008-ap-goals-12wk"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 12-week goals" ON "0008-ap-goals-12wk"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own 12-week goals" ON "0008-ap-goals-12wk"
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_global_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_goals_12wk_updated_at()
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
        WHERE tgname = 'update_global_cycles_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_global_cycles_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-global-cycles"
          FOR EACH ROW
          EXECUTE FUNCTION update_global_cycles_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_goals_12wk_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_goals_12wk_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-goals-12wk"
          FOR EACH ROW
          EXECUTE FUNCTION update_goals_12wk_updated_at();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_cycles_active ON "0008-ap-global-cycles"(is_active);
CREATE INDEX IF NOT EXISTS idx_global_cycles_dates ON "0008-ap-global-cycles"(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_user_id ON "0008-ap-goals-12wk"(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_status ON "0008-ap-goals-12wk"(status);
CREATE INDEX IF NOT EXISTS idx_goals_12wk_cycle ON "0008-ap-goals-12wk"(global_cycle_id);

-- Insert a default active cycle if none exists
INSERT INTO "0008-ap-global-cycles" (
  title,
  cycle_label,
  start_date,
  end_date,
  reflection_start,
  reflection_end,
  is_active
) VALUES (
  '2025 Q1 Cycle',
  'Q1 2025',
  '2025-01-01',
  '2025-03-26',
  '2025-03-27',
  '2025-04-02',
  true
) ON CONFLICT DO NOTHING;