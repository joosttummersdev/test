/*
  # Remove authentication restrictions
  
  1. Changes
    - Update RLS policies to allow all access
    - Set default role to admin for all users
    - Make all profiles accessible
    
  2. Impact
    - All users can access admin and agent features
    - No role restrictions
*/

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow user to read own profile" ON profiles;
DROP POLICY IF EXISTS "allow_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_admin_full_access" ON profiles;
DROP POLICY IF EXISTS "Allow logged-in users to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow user to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;

-- Create unrestricted policy
CREATE POLICY "Allow full access"
ON profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Update all existing users to have admin role
UPDATE profiles
SET role = 'admin'
WHERE role != 'admin';

-- Update user metadata for all users
UPDATE auth.users
SET 
  raw_user_meta_data = jsonb_build_object(
    'role', 'admin',
    'roles', jsonb_build_array('admin', 'agent')
  ),
  raw_app_meta_data = jsonb_build_object(
    'role', 'admin',
    'roles', jsonb_build_array('admin', 'agent')
  );

-- Remove role restrictions from auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
    'admin',  -- Always set role to admin
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    now(),
    now()
  );

  RETURN NEW;
END;
$$;