/*
  # Fix User Profile System

  1. Changes
    - Add NOT NULL constraints for required fields
    - Add email sync trigger
    - Fix profile creation trigger
    - Add proper role validation
    
  2. Security
    - Maintain RLS policies
    - Ensure proper role assignment
*/

-- Add NOT NULL constraints
ALTER TABLE profiles
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- Add role validation
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE profiles
  ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'agent'));

-- Create email sync trigger
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email <> OLD.email THEN
    UPDATE profiles
    SET 
      email = NEW.email,
      updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for email sync
DROP TRIGGER IF EXISTS sync_user_email_trigger ON auth.users;
CREATE TRIGGER sync_user_email_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION sync_user_email();

-- Update profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_role text;
BEGIN
  -- Get role from metadata or default to 'agent'
  default_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'agent'
  );

  -- Validate role
  IF default_role NOT IN ('admin', 'agent') THEN
    default_role := 'agent';
  END IF;

  -- Create profile
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
    default_role,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    now(),
    now()
  );

  -- Update user metadata to match
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', default_role)
  WHERE id = NEW.id;

  -- Create user settings
  INSERT INTO user_settings (
    user_id,
    email_notifications,
    sale_notifications
  ) VALUES (
    NEW.id,
    true,
    true
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure all existing users have profiles
INSERT INTO profiles (
  id,
  email,
  role,
  first_name,
  last_name,
  created_at,
  updated_at
)
SELECT 
  id,
  email,
  COALESCE(raw_app_meta_data->>'role', 'agent'),
  COALESCE(raw_user_meta_data->>'first_name', 'New'),
  COALESCE(raw_user_meta_data->>'last_name', 'User'),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
);

-- Ensure all users have settings
INSERT INTO user_settings (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT DO NOTHING;