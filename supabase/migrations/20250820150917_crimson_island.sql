/*
  # Add activated_task_id column to deposit ideas

  1. Schema Changes
     - Add `activated_task_id` column to link DIs to their activated tasks
     - Add index for performance
     - Add foreign key constraint

  2. Triggers
     - Auto-archive DIs when their activated tasks are completed/cancelled
     - Handle task deletion to avoid orphaned links

  3. Security
     - Maintain existing RLS policies
*/

-- Add activated_task_id column to deposit ideas table
ALTER TABLE "0008-ap-deposit-ideas"
  ADD COLUMN IF NOT EXISTS activated_task_id uuid REFERENCES "0008-ap-tasks"(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_deposit_ideas_activated_task_id 
  ON "0008-ap-deposit-ideas"(activated_task_id);

-- Create trigger function to auto-archive deposit ideas when activated tasks are completed/cancelled
CREATE OR REPLACE FUNCTION auto_archive_deposit_ideas_by_task_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the task status changed to completed or cancelled
    IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
        -- Find and archive the source deposit idea using activated_task_id
        UPDATE "0008-ap-deposit-ideas" 
        SET 
            is_active = false,
            archived = true,
            updated_at = now()
        WHERE activated_task_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the auto-archive trigger to tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'auto_archive_deposit_ideas_by_task_id_trigger'
    ) THEN
        CREATE TRIGGER auto_archive_deposit_ideas_by_task_id_trigger
          AFTER UPDATE ON "0008-ap-tasks"
          FOR EACH ROW
          EXECUTE FUNCTION auto_archive_deposit_ideas_by_task_id();
    END IF;
END $$;

-- Handle task deletion to avoid orphaned links
CREATE OR REPLACE FUNCTION handle_task_deletion_for_deposit_ideas()
RETURNS TRIGGER AS $$
BEGIN
    -- Archive any deposit ideas that were linked to the deleted task
    UPDATE "0008-ap-deposit-ideas" 
    SET 
        is_active = false,
        archived = true,
        updated_at = now()
    WHERE activated_task_id = OLD.id;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Apply the deletion trigger to tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'handle_task_deletion_for_deposit_ideas_trigger'
    ) THEN
        CREATE TRIGGER handle_task_deletion_for_deposit_ideas_trigger
          AFTER DELETE ON "0008-ap-tasks"
          FOR EACH ROW
          EXECUTE FUNCTION handle_task_deletion_for_deposit_ideas();
    END IF;
END $$;