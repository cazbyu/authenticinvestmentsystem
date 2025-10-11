/*
  # Create Withdrawals and Snapshots System with withdrawn_at

  ## Overview
  Creates the withdrawals tracking system with proper timestamp column naming.

  ## Changes Made

  1. New Tables
     - `0008-ap-withdrawals` - Withdrawal records with amount and reason
       - Uses `withdrawn_at` (timestamptz) instead of `withdrawal_date` for proper timestamp tracking
     - `0008-ap-snapshots` - Weekly balance snapshots per user/scope

  2. Security
     - Enable RLS on both tables
     - Add policies for authenticated users to manage their own data

  3. Triggers
     - Auto-update timestamps for withdrawals and snapshots

  4. Performance
     - Indexes on user_id and withdrawn_at for efficient queries
*/

-- Create the withdrawals table with withdrawn_at
CREATE TABLE IF NOT EXISTS "0008-ap-withdrawals" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  withdrawn_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create the snapshots table for weekly balance tracking
CREATE TABLE IF NOT EXISTS "0008-ap-snapshots" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scope_type text NOT NULL CHECK (scope_type IN ('user', 'role', 'key_relationship', 'domain')),
  scope_id uuid,
  week_start_date date NOT NULL,
  deposits_total numeric(10,2) DEFAULT 0,
  withdrawals_total numeric(10,2) DEFAULT 0,
  balance numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, scope_type, scope_id, week_start_date)
);

-- Enable RLS
ALTER TABLE "0008-ap-withdrawals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-snapshots" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawals
CREATE POLICY "Users can select their own withdrawals" ON "0008-ap-withdrawals"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawals" ON "0008-ap-withdrawals"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own withdrawals" ON "0008-ap-withdrawals"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own withdrawals" ON "0008-ap-withdrawals"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for snapshots
CREATE POLICY "Users can select their own snapshots" ON "0008-ap-snapshots"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots" ON "0008-ap-snapshots"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" ON "0008-ap-snapshots"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" ON "0008-ap-snapshots"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger function for auto-updating withdrawal timestamps
CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to withdrawals table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_withdrawals_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_withdrawals_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-withdrawals"
          FOR EACH ROW
          EXECUTE FUNCTION update_withdrawals_updated_at();
    END IF;
END $$;

-- Create trigger function for auto-updating snapshot timestamps
CREATE OR REPLACE FUNCTION update_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to snapshots table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_snapshots_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_snapshots_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-snapshots"
          FOR EACH ROW
          EXECUTE FUNCTION update_snapshots_updated_at();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON "0008-ap-withdrawals"(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_withdrawn_at ON "0008-ap-withdrawals"(withdrawn_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_scope ON "0008-ap-snapshots"(user_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_week ON "0008-ap-snapshots"(week_start_date);
