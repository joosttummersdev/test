/*
  # Fix User Profile System

  1. Changes
    - Drop existing RLS policies
    - Create proper policies for user isolation
    - Fix profile creation trigger
    - Add proper role validation
    
  2. Security
    - Users can only access their own profile
    - Admins can access all profiles
    - Proper role validation on creation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow full access" ON profiles;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies
CREATE POLICY "Users can manage their own profile"
ON profiles
FOR ALL
TO authenticated
USING (
  id = auth.uid()
);

CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Add role validation check
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE profiles ADD CONSTRAINT valid_role 
  CHECK (role IN ('admin', 'agent'));

-- Update profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_role text;
  first_name_val text;
  last_name_val text;
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

  -- Get name values
  first_name_val := COALESCE(NEW.raw_user_meta_data->>'first_name', 'New');
  last_name_val := COALESCE(NEW.raw_user_meta_data->>'last_name', 'User');

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
    first_name_val,
    last_name_val,
    now(),
    now()
  );

  -- Log profile creation
  INSERT INTO auth_logs (
    user_id,
    event_type,
    details
  ) VALUES (
    NEW.id,
    'PROFILE_CREATED',
    jsonb_build_object(
      'role', default_role,
      'email', NEW.email,
      'first_name', first_name_val,
      'last_name', last_name_val
    )
  );

  RETURN NEW;
END;
$$;

-- Create user settings for existing users
INSERT INTO user_settings (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT DO NOTHING;

-- Add system settings if needed
INSERT INTO system_settings (name, value)
VALUES 
  ('default_role', '"agent"'),
  ('allow_registration', 'true'),
  ('require_email_verification', 'false')
ON CONFLICT (name) DO NOTHING;

-- Verify existing profiles have proper roles
UPDATE profiles
SET role = 'agent'
WHERE role NOT IN ('admin', 'agent');

-- Log changes
INSERT INTO auth_logs (
  event_type,
  details
)
VALUES (
  'SYSTEM_UPDATE',
  jsonb_build_object(
    'message', 'Fixed user profile system',
    'timestamp', now()
  )
);