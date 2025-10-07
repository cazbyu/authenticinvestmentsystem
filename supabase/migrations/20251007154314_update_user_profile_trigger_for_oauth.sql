/*
  # Update User Profile Trigger for OAuth Support

  1. Changes
     - Update handle_new_user_profile function to extract OAuth metadata
     - Extract profile picture from Google OAuth data
     - Extract first_name and last_name from OAuth providers
     - Set oauth_provider and profile_image_source appropriately
     - Support both email/password and OAuth sign-ups

  2. OAuth Metadata Handling
     - Google provides: avatar_url, full_name, name
     - Parse full_name into first_name and last_name if needed
     - Store avatar_url in profile_image field
     - Set profile_image_source to 'oauth' when using OAuth picture

  3. Important Notes
     - Function is SECURITY DEFINER to access auth.users table
     - Handles both new OAuth users and email/password users
     - Does not overwrite existing profiles (ON CONFLICT DO NOTHING)
*/

-- Drop and recreate the function with OAuth support
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_profile_image text;
  v_oauth_provider text;
  v_profile_image_source text;
  v_full_name text;
BEGIN
  -- Determine OAuth provider
  -- Check if user signed up with OAuth (has identities)
  IF EXISTS (
    SELECT 1 FROM auth.identities 
    WHERE user_id = NEW.id AND provider != 'email'
  ) THEN
    -- Get the OAuth provider name
    SELECT provider INTO v_oauth_provider
    FROM auth.identities
    WHERE user_id = NEW.id AND provider != 'email'
    LIMIT 1;
  ELSE
    v_oauth_provider := 'email';
  END IF;

  -- Extract profile image from OAuth metadata
  v_profile_image := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- Set profile image source
  IF v_profile_image IS NOT NULL THEN
    v_profile_image_source := 'oauth';
  ELSE
    v_profile_image_source := 'default';
  END IF;

  -- Extract first name
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    ''
  );

  -- Extract last name
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    ''
  );

  -- If first_name is empty but we have full_name, try to parse it
  IF (v_first_name = '' OR v_first_name IS NULL) THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    );

    IF v_full_name IS NOT NULL THEN
      -- Split full name on first space
      v_first_name := COALESCE(split_part(v_full_name, ' ', 1), '');
      -- Everything after first space is last name
      IF position(' ' in v_full_name) > 0 THEN
        v_last_name := COALESCE(substring(v_full_name from position(' ' in v_full_name) + 1), '');
      END IF;
    END IF;
  END IF;

  -- Insert the user profile
  INSERT INTO "0008-ap-users" (
    user_id,
    first_name,
    last_name,
    profile_image,
    oauth_provider,
    profile_image_source
  )
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    v_profile_image,
    v_oauth_provider,
    v_profile_image_source
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Ensure trigger exists (it should from previous migration, but we'll recreate it)
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_profile();
