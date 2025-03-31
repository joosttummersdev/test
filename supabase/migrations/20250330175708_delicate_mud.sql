/*
  # Fix Profiles RLS Policies to Prevent Recursion

  1. Changes
    - Drop all existing policies
    - Create simple, non-recursive policies
    - Use JWT claims for role checks
    - Enable RLS
    
  2. Security
    - Users can read their own profile
    - Admins can manage all profiles
    - Prevent infinite recursion
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow full access" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow user to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;

-- Create simple policy for users to read their own profile
CREATE POLICY "read_own_profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Create policy for admins using JWT claims
CREATE POLICY "admin_manage_all"
ON profiles
FOR ALL
TO authenticated
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin',
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin',
    false
  )
);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;

-- Update trigger function to properly set metadata
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

  RETURN NEW;
END;
$$;

-- Ensure all existing users have correct metadata
DO $$
BEGIN
  UPDATE auth.users u
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', p.role)
  FROM profiles p
  WHERE u.id = p.id;
END $$;