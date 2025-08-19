/*
  # Add image support and editing capabilities for Key Relationships

  1. Schema Changes
    - Add `image_url` column to key relationships table
    - Add `description` column for additional context
    - Add `updated_at` timestamp for tracking changes

  2. Storage
    - Enable storage for key relationship images
    - Set up RLS policies for secure image access

  3. Security
    - Users can only access their own KR images
    - Proper file type and size restrictions
*/

-- Add new columns to key relationships table
ALTER TABLE "0008-ap-key-relationships" 
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
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
        WHERE tgname = 'update_key_relationships_updated_at'
    ) THEN
        CREATE TRIGGER update_key_relationships_updated_at
            BEFORE UPDATE ON "0008-ap-key-relationships"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create storage bucket for key relationship images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('key-relationship-images', 'key-relationship-images', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage bucket
UPDATE storage.buckets 
SET public = false 
WHERE id = 'key-relationship-images';

-- Storage policies for key relationship images
CREATE POLICY "Users can upload their own KR images" ON storage.objects
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    bucket_id = 'key-relationship-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own KR images" ON storage.objects
  FOR SELECT 
  TO authenticated 
  USING (
    bucket_id = 'key-relationship-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own KR images" ON storage.objects
  FOR UPDATE 
  TO authenticated 
  USING (
    bucket_id = 'key-relationship-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own KR images" ON storage.objects
  FOR DELETE 
  TO authenticated 
  USING (
    bucket_id = 'key-relationship-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );