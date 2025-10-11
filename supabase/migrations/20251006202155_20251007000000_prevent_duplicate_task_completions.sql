/*
  # Prevent Duplicate Task Completions

  1. Changes
    - Add unique partial index on 0008-ap-tasks to prevent duplicate completed occurrences
    - Index ensures only one completed occurrence can exist per parent_task_id and due_date combination
  
  2. Security
    - No RLS changes needed - this is a data integrity constraint
  
  3. Notes
    - The partial index only applies to completed tasks with a parent_task_id (occurrences)
    - This prevents race conditions and duplicate completion attempts
    - Does not affect standalone tasks or non-completed statuses
*/

-- Create unique partial index to prevent duplicate completions
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_completed_occurrence 
ON "0008-ap-tasks" (parent_task_id, due_date) 
WHERE status = 'completed' 
AND parent_task_id IS NOT NULL 
AND deleted_at IS NULL;
