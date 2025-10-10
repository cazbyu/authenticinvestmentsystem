/*
  # Create Suggestions Table

  1. New Tables
    - `0008-ap-suggestions`
      - `id` (uuid, primary key) - Unique identifier for each suggestion
      - `user_id` (uuid, foreign key) - References auth.users
      - `content` (text) - The suggestion content
      - `status` (text) - Status: pending, reviewed, implemented, declined
      - `admin_notes` (text, nullable) - Optional notes from admin
      - `created_at` (timestamptz) - When the suggestion was created
      - `updated_at` (timestamptz) - When the suggestion was last updated

  2. Security
    - Enable RLS on `0008-ap-suggestions` table
    - Add policy for authenticated users to insert their own suggestions
    - Add policy for authenticated users to read their own suggestions
    - Add policy for authenticated users to view status updates on their suggestions

  3. Indexes
    - Index on user_id for faster lookups
    - Index on status for filtering by status
    - Index on created_at for sorting

  4. Notes
    - All users can submit suggestions
    - Users can only view their own suggestions
    - Status updates and admin notes are managed through admin interface
*/

-- Create the suggestions table
CREATE TABLE IF NOT EXISTS "0008-ap-suggestions" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for status values
ALTER TABLE "0008-ap-suggestions"
  ADD CONSTRAINT check_status CHECK (status IN ('pending', 'reviewed', 'implemented', 'declined'));

-- Add check constraint for content length
ALTER TABLE "0008-ap-suggestions"
  ADD CONSTRAINT check_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 1000);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON "0008-ap-suggestions"(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON "0008-ap-suggestions"(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON "0008-ap-suggestions"(created_at DESC);

-- Enable RLS
ALTER TABLE "0008-ap-suggestions" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own suggestions
CREATE POLICY "Users can insert own suggestions"
  ON "0008-ap-suggestions"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can select their own suggestions
CREATE POLICY "Users can select own suggestions"
  ON "0008-ap-suggestions"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own pending suggestions (content only, not status)
CREATE POLICY "Users can update own pending suggestions"
  ON "0008-ap-suggestions"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_suggestions_updated_at
  BEFORE UPDATE ON "0008-ap-suggestions"
  FOR EACH ROW
  EXECUTE FUNCTION update_suggestions_updated_at();