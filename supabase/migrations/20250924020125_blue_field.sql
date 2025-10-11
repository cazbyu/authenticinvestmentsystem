/*
  # Fix week number constraint for custom timelines

  1. Problem
     - Current constraint limits week_number to maximum 12 weeks
     - Custom timelines can have more than 12 weeks
     - This causes constraint violations when saving tasks

  2. Solution
     - Drop the existing week_number_check constraint
     - Add new constraint that only enforces minimum value (>= 1)
     - This allows custom timelines to have unlimited weeks while maintaining data integrity
*/

-- Drop the existing constraint that limits week_number to 12
ALTER TABLE "0008-ap-task-week-plan" DROP CONSTRAINT IF EXISTS "0008-ap-task-week-plan_week_number_check";

-- Add new constraint that only enforces minimum value
ALTER TABLE "0008-ap-task-week-plan" ADD CONSTRAINT "0008-ap-task-week-plan_week_number_check" 
  CHECK (week_number >= 1);