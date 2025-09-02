/*
  # Add Recurrence Support to Tasks and Events

  1. Schema Changes
     - Add `recurrence_rule` column to tasks table for storing RRULE strings
     - Add index for performance on recurrence queries

  2. Notes
     - Recurrence rules follow RFC 5545 RRULE format
     - Both tasks and events can now have recurrence patterns
     - Calendar views will expand recurring instances using existing recurrence utilities
*/

-- Add recurrence_rule column to tasks table
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- Create index for performance on recurrence queries
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_rule ON "0008-ap-tasks"(recurrence_rule) 
  WHERE recurrence_rule IS NOT NULL;

-- Create index for recurring tasks/events queries
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_type ON "0008-ap-tasks"(type, recurrence_rule) 
  WHERE recurrence_rule IS NOT NULL;