/*
  # Add image support and editing capabilities for Key Relationships

  1. Schema Changes
     - Add `description` column for additional context.
     - Add `updated_at` timestamp for tracking changes.

  2. Storage
     - Set up RLS policies for the "0008-key-relationship-images" bucket.

  3. Security
     - Users can only upload, view, update, and delete their own KR images.
*/

-- Add description and timestamp columns to the key relationships table.
-- Assumes 'image_path' (renamed from image_url) already exists.
ALTER TABLE "0008-ap-key-relationships"
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create a trigger function to automatically update the 'updated_at' timestamp on any row update.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to the key relationships table if it doesn't already exist.
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

-- Policies for securing the "0008-key-relationship-images" storage bucket.
-- These policies ensure that users can only manage images associated with their own user ID.

CREATE POLICY "Users can upload their own KR images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-key-relationship-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own KR images" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = '0008-key-relationship-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own KR images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-key-relationship-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own KR images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-key-relationship-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );