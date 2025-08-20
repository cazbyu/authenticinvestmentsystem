/*
  # Create Wellness Domains Table

  1. New Tables
     - `0008-ap-domains` - Wellness domains table with 8 predefined domains

  2. Data
     - Insert 8 wellness domains: Community, Financial, Physical, Social, Emotional, Intellectual, Recreational, Spiritual
     - Each domain includes name and description

  3. Security
     - Enable RLS on domains table
     - Add policy for authenticated users to read domains
*/

-- Create the wellness domains table
CREATE TABLE IF NOT EXISTS "0008-ap-domains" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "0008-ap-domains" ENABLE ROW LEVEL SECURITY;

-- Add policy for authenticated users to read domains
CREATE POLICY "Authenticated users can read domains" ON "0008-ap-domains"
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert the 8 wellness domains
INSERT INTO "0008-ap-domains" (name, description, sort_order) VALUES
  ('Community', 'Relationships and connections with your local and broader community', 1),
  ('Financial', 'Money management, investments, and financial security', 2),
  ('Physical', 'Exercise, nutrition, sleep, and overall physical health', 3),
  ('Social', 'Friendships, family relationships, and social connections', 4),
  ('Emotional', 'Mental health, stress management, and emotional well-being', 5),
  ('Intellectual', 'Learning, growth, creativity, and mental stimulation', 6),
  ('Recreational', 'Hobbies, entertainment, and activities that bring joy', 7),
  ('Spiritual', 'Purpose, meaning, values, and spiritual practices', 8)
ON CONFLICT (name) DO NOTHING;

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to domains table
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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_domains_sort_order ON "0008-ap-domains"(sort_order);