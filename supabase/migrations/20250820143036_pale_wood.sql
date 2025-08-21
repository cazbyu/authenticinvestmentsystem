/*
  # Create Deposit Ideas System

  1. New Tables
     - `0008-ap-deposit-ideas` - Main deposit ideas table
     - `0008-ap-deposit-idea-activations` - Mapping between deposit ideas and activated tasks

  2. Security
     - Enable RLS on both tables
     - Add policies for authenticated users to manage their own data

  3. Triggers
     - Auto-update timestamps
     - Auto-archive deposit ideas when activated tasks are completed/cancelled
*/

-- Create the deposit ideas table (if it doesn't exist)
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
  CONSTRAINT "0008-ap-deposit-ideas_pkey" PRIMARY KEY (id)
);

-- Create the activation mapping table
CREATE TABLE IF NOT EXISTS "0008-ap-deposit-idea-activations" (
  di_id uuid NOT NULL REFERENCES "0008-ap-deposit-ideas"(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT "0008-ap-deposit-idea-activations_pkey" PRIMARY KEY (di_id),
  CONSTRAINT "0008-ap-deposit-idea-activations_task_id_unique" UNIQUE (task_id)
);

-- Enable RLS
ALTER TABLE "0008-ap-deposit-ideas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-deposit-idea-activations" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deposit ideas
CREATE POLICY "Users can select their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deposit ideas" ON "0008-ap-deposit-ideas"
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for activation mappings
CREATE POLICY "Users can select their own activation mappings" ON "0008-ap-deposit-idea-activations"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-deposit-ideas" di 
      WHERE di.id = di_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own activation mappings" ON "0008-ap-deposit-idea-activations"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0008-ap-deposit-ideas" di 
      WHERE di.id = di_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own activation mappings" ON "0008-ap-deposit-idea-activations"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-deposit-ideas" di 
      WHERE di.id = di_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own activation mappings" ON "0008-ap-deposit-idea-activations"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "0008-ap-deposit-ideas" di 
      WHERE di.id = di_id AND di.user_id = auth.uid()
    )
  );

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_deposit_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to deposit ideas table
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

-- Create trigger function to auto-archive deposit ideas when tasks are completed/cancelled
CREATE OR REPLACE FUNCTION auto_archive_deposit_ideas()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the task status changed to completed or cancelled
    IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
        -- Find and archive the source deposit idea
        UPDATE "0008-ap-deposit-ideas" 
        SET 
            is_active = false,
            archived = true,
            updated_at = now()
        WHERE id IN (
            SELECT di_id 
            FROM "0008-ap-deposit-idea-activations" 
            WHERE task_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the auto-archive trigger to tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'auto_archive_deposit_ideas_trigger'
    ) THEN
        CREATE TRIGGER auto_archive_deposit_ideas_trigger
          AFTER UPDATE ON "0008-ap-tasks"
          FOR EACH ROW
          EXECUTE FUNCTION auto_archive_deposit_ideas();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposit_ideas_user_id ON "0008-ap-deposit-ideas"(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_ideas_active_archived ON "0008-ap-deposit-ideas"(is_active, archived);
CREATE INDEX IF NOT EXISTS idx_deposit_idea_activations_di_id ON "0008-ap-deposit-idea-activations"(di_id);
CREATE INDEX IF NOT EXISTS idx_deposit_idea_activations_task_id ON "0008-ap-deposit-idea-activations"(task_id);