/*
  # Update Admin User Metadata

  1. Changes
    - Updates the raw_app_meta_data for the admin user
    - Adds "role": "admin" to the metadata
    - Targets user with email joost@yoobar.nl

  2. Security
    - Only affects the specific admin user
    - Preserves existing metadata
*/

UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    WHEN raw_app_meta_data IS NULL THEN 
      jsonb_build_object('role', 'admin')
    ELSE 
      raw_app_meta_data || jsonb_build_object('role', 'admin')
  END
WHERE email = 'joost@yoobar.nl';