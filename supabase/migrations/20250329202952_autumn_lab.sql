/*
  # Fix user profiles and ensure required fields

  1. Changes
    - Add NOT NULL constraints for required fields
    - Update existing records with default values
    - Add trigger to ensure email sync
    - Add validation for required fields
    
  2. Security
    - Maintain existing RLS policies
*/

-- First ensure all existing profiles have required fields
UPDATE profiles
SET 
  first_name = COALESCE(NULLIF(TRIM(first_name), ''), 'New'),
  last_name = COALESCE(NULLIF(TRIM(last_name), ''), 'User'),
  role = COALESCE(NULLIF(TRIM(role), ''), 'agent'),
  email = COALESCE(
    NULLIF(TRIM(email), ''),
    (SELECT email FROM auth.users WHERE users.id = profiles.id)
  );

-- Add NOT NULL constraints
ALTER TABLE profiles
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- Add check constraint for role
ALTER TABLE profiles
  ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'agent'));

-- Create or replace trigger function for user creation/updates
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  role_value text;
  first_name_value text;
  last_name_value text;
BEGIN
  -- Get values with validation
  role_value := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
    NULLIF(TRIM(NEW.raw_app_meta_data->>'role'), ''),
    'agent'
  );
  
  first_name_value := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    'New'
  );
  
  last_name_value := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    'User'
  );

  -- Validate role
  IF role_value NOT IN ('admin', 'agent') THEN
    role_value := 'agent';
  END IF;

  -- Insert or update profile
  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    role_value,
    first_name_value,
    last_name_value,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    role = CASE 
      WHEN EXCLUDED.role IN ('admin', 'agent') THEN EXCLUDED.role 
      ELSE profiles.role 
    END,
    first_name = CASE 
      WHEN EXCLUDED.first_name IS NOT NULL AND TRIM(EXCLUDED.first_name) <> '' 
      THEN EXCLUDED.first_name 
      ELSE profiles.first_name 
    END,
    last_name = CASE 
      WHEN EXCLUDED.last_name IS NOT NULL AND TRIM(EXCLUDED.last_name) <> '' 
      THEN EXCLUDED.last_name 
      ELSE profiles.last_name 
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;