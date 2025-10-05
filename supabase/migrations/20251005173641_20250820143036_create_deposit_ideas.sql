/*
  # Create Deposit Ideas System

  1. New Tables
     - `0008-ap-deposit-ideas` - Deposit ideas for later activation

  2. Security
     - Enable RLS
     - Users manage their own deposit ideas

  3. Schema
     - Support for activation tracking
     - Archive status
*/

CREATE TABLE IF NOT EXISTS "0008-ap-deposit-ideas" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NULL,
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  user_id uuid NULL REFERENCES auth.users(id),
  activated_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  follow_up boolean NOT NULL DEFAULT false,
  activated_task_id uuid REFERENCES "0008-ap-tasks"(id) ON DELETE SET NULL,
  CONSTRAINT "0008-ap-deposit-ideas_pkey" PRIMARY KEY (id)
);

ALTER TABLE "0008-ap-deposit-ideas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_deposit_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_deposit_ideas_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_deposit_ideas_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-deposit-ideas"
          FOR EACH ROW
          EXECUTE FUNCTION update_deposit_ideas_updated_at();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deposit_ideas_user_id ON "0008-ap-deposit-ideas"(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_ideas_active_archived ON "0008-ap-deposit-ideas"(is_active, archived);
CREATE INDEX IF NOT EXISTS idx_deposit_ideas_activated_task_id ON "0008-ap-deposit-ideas"(activated_task_id);
