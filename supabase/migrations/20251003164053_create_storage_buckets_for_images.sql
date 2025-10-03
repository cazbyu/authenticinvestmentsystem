-- Create Storage Buckets for Images
--
-- 1. New Storage Buckets
--    - 0008-role-images - Public bucket for role images
--    - 0008-key-relationship-images - Public bucket for key relationship images
--    - 0008-ap-profile-images - Public bucket for profile images
--
-- 2. Configuration
--    - All buckets set to PUBLIC for easy access
--    - File size limit: 5MB per file
--    - Allowed MIME types: image/* (all image formats)
--
-- 3. Security
--    - RLS policies already exist and will be applied
--    - Public access allows getPublicUrl() to work correctly
--    - Authenticated users can upload/update/delete their own images

-- Create role images bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-role-images',
  '0008-role-images',
  true,
  5242880,
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/*'];

-- Create key relationship images bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-key-relationship-images',
  '0008-key-relationship-images',
  true,
  5242880,
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/*'];

-- Create profile images bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-ap-profile-images',
  '0008-ap-profile-images',
  true,
  5242880,
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/*'];
