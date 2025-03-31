/*
  # Update admin user metadata and role

  1. Changes
    - Update user metadata for admin account
    - Set admin role in app_metadata
    - Ensure proper role assignment
*/

-- Update the admin user's metadata
UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    WHEN raw_app_meta_data IS NULL THEN 
      jsonb_build_object('role', 'admin')
    ELSE 
      raw_app_meta_data || jsonb_build_object('role', 'admin')
  END
WHERE email = 'joost@yoobar.nl';

-- Ensure the user has the correct role in their metadata
DO $$ 
BEGIN
  -- Update the user's role if it exists but doesn't have admin role
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
  WHERE email = 'joost@yoobar.nl'
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'admin');
END $$;