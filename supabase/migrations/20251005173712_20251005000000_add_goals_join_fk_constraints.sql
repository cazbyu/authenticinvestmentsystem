/*
  # Add Foreign Key Constraints to Universal Goals Join

  1. Schema Changes
     - Add foreign key constraints for twelve_wk_goal_id and custom_goal_id
     - Ensures referential integrity for polymorphic goal associations

  2. Security
     - No changes to RLS policies

  3. Notes
     - Foreign keys use CASCADE delete to clean up join records when goals are deleted
*/

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_twelve_wk_goal'
    ) THEN
        ALTER TABLE "0008-ap-universal-goals-join"
          ADD CONSTRAINT "fk_twelve_wk_goal" 
          FOREIGN KEY (twelve_wk_goal_id) REFERENCES "0008-ap-goals-12wk"(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_custom_goal'
    ) THEN
        ALTER TABLE "0008-ap-universal-goals-join"
          ADD CONSTRAINT "fk_custom_goal" 
          FOREIGN KEY (custom_goal_id) REFERENCES "0008-ap-goals-custom"(id) ON DELETE CASCADE;
    END IF;
END $$;
