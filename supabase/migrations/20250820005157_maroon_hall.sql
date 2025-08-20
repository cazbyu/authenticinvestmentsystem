/*
  # Add Role Customization Features

  1. Schema Changes
     - Add `image_path` column for role profile pictures
     - Add `color` column for custom role header colors

  2. Storage
     - Set up RLS policies for the "0008-role-images" bucket

  3. Security
     - Users can only upload, view, update, and delete their own role images
*/

-- Add image_path and color columns to the roles table
ALTER TABLE "0008-ap-roles"
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS color text;

-- Policies for securing the "0008-role-images" storage bucket
-- These policies ensure that users can only manage images associated with their own user ID

CREATE POLICY "Users can upload their own role images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-role-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own role images" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = '0008-role-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own role images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-role-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own role images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-role-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );