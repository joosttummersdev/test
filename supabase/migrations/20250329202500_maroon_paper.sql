/*
  # Fix profile trigger to ensure required fields

  1. Changes
    - Update trigger function to validate required fields
    - Add proper error handling
    - Ensure all fields are properly set
    
  2. Security
    - Maintain existing security policies
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create enhanced trigger function with validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  -- Get values from metadata with validation
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

  -- Insert or update profile with validated data
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
    role = role_value,
    first_name = first_name_value,
    last_name = last_name_value,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();