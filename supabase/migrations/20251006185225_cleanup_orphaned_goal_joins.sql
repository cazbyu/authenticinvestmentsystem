/*
  # Cleanup Orphaned Goal Join Records

  1. Purpose
     - Remove join records from 0008-ap-universal-goals-join where referenced goals are deleted, archived, or cancelled
     - Clean up data integrity issues where tasks reference non-existent or inactive goals

  2. Actions
     - Delete join records where twelve_wk_goal_id references an archived or cancelled goal
     - Delete join records where custom_goal_id references an archived or cancelled goal
     - Delete join records where the referenced goal no longer exists (orphaned foreign keys)

  3. Notes
     - This is a one-time cleanup migration
     - Future orphaned records should be prevented by proper goal archiving flows
*/

-- Delete join records for archived/cancelled 12-week goals
DELETE FROM "0008-ap-universal-goals-join"
WHERE goal_type = 'twelve_wk_goal'
  AND twelve_wk_goal_id IN (
    SELECT id FROM "0008-ap-goals-12wk"
    WHERE status IN ('archived', 'cancelled')
  );

-- Delete join records for archived/cancelled custom goals
DELETE FROM "0008-ap-universal-goals-join"
WHERE goal_type = 'custom_goal'
  AND custom_goal_id IN (
    SELECT id FROM "0008-ap-goals-custom"
    WHERE status IN ('archived', 'cancelled')
  );

-- Delete orphaned join records where the 12-week goal no longer exists
DELETE FROM "0008-ap-universal-goals-join"
WHERE goal_type = 'twelve_wk_goal'
  AND twelve_wk_goal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "0008-ap-goals-12wk"
    WHERE id = "0008-ap-universal-goals-join".twelve_wk_goal_id
  );

-- Delete orphaned join records where the custom goal no longer exists
DELETE FROM "0008-ap-universal-goals-join"
WHERE goal_type = 'custom_goal'
  AND custom_goal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "0008-ap-goals-custom"
    WHERE id = "0008-ap-universal-goals-join".custom_goal_id
  );
