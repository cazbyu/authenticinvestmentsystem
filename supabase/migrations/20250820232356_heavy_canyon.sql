/*
  # Add RLS Policy for Wellness Domains

  1. Security
     - Enable RLS on `0008-ap-domains` table
     - Add policy for authenticated users to read all domains

  2. Notes
     - Domains are shared across all users, so all authenticated users can read them
     - No insert/update/delete policies needed as domains are system-managed
*/

-- Enable row level security on domains table
ALTER TABLE "0008-ap-domains" ENABLE ROW LEVEL SECURITY;

-- Add policy for authenticated users to read all domains
CREATE POLICY "Authenticated users can read all domains" ON "0008-ap-domains"
  FOR SELECT
  TO authenticated
  USING (true);