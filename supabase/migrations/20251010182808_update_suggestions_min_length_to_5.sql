/*
  # Update Suggestions Table - Reduce Minimum Length

  1. Changes
    - Update check constraint on `0008-ap-suggestions` table
    - Change minimum content length from 10 characters to 5 characters
    - Keep maximum length at 1000 characters

  2. Notes
    - This allows users to submit shorter, more concise suggestions
    - The change is backward compatible (existing suggestions with 10+ chars are still valid)
*/

-- Drop the existing constraint
ALTER TABLE "0008-ap-suggestions"
  DROP CONSTRAINT IF EXISTS check_content_length;

-- Add updated constraint with 5 character minimum
ALTER TABLE "0008-ap-suggestions"
  ADD CONSTRAINT check_content_length CHECK (char_length(content) >= 5 AND char_length(content) <= 1000);
