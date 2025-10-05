/*
  # Create Wellness Domains Table

  1. New Tables
     - `0008-ap-domains` - Wellness domains table with 8 predefined domains

  2. Data
     - Insert 8 wellness domains: Community, Financial, Physical, Social, Emotional, Intellectual, Recreational, Spiritual

  3. Security
     - Enable RLS on domains table
     - Add policy for authenticated users to read domains
*/

CREATE TABLE IF NOT EXISTS "0008-ap-domains" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE "0008-ap-domains" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read domains" ON "0008-ap-domains"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own domains" ON "0008-ap-domains"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains" ON "0008-ap-domains"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own domains" ON "0008-ap-domains"
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_domains_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_domains_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-domains"
          FOR EACH ROW
          EXECUTE FUNCTION update_domains_updated_at();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_domains_sort_order ON "0008-ap-domains"(sort_order);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON "0008-ap-domains"(user_id);
