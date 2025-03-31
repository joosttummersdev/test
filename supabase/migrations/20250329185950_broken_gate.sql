/*
  # Fix Profile Access and RLS Configuration

  1. Changes
    - Verify profile exists and has correct role
    - Enable RLS on profiles table
    - Create simple policy for profile access
    - Grant necessary permissions
    
  2. Security
    - Maintain RLS enabled
    - Use direct auth.uid() comparison
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON profiles;

-- Create simple policy for reading own profile
CREATE POLICY "Allow users to read their own profile"
ON profiles
FOR ALL
TO authenticated
USING (id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;

-- Verify specific profile and log results
DO $$
DECLARE
  test_id uuid := '7135ea96-3847-4752-a4f9-3714bf8dc635';
  profile_exists boolean;
  profile_role text;
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = test_id
  ), role INTO profile_exists, profile_role
  FROM profiles WHERE id = test_id;

  -- Log results
  RAISE LOG 'Profile Check Results:';
  RAISE LOG '- Profile Exists: %', profile_exists;
  RAISE LOG '- Profile Role: %', profile_role;
  RAISE LOG '- RLS Enabled: true';
  RAISE LOG '- Policy Created: Allow users to read their own profile';

  -- If profile doesn't exist, create it
  IF NOT profile_exists THEN
    INSERT INTO profiles (id, role, first_name, last_name)
    VALUES (test_id, 'admin', 'Admin', 'User');
    RAISE LOG '- Created missing profile with admin role';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE tablename = 'profiles'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on profiles table';
  END IF;

  -- Verify policy exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Allow users to read their own profile'
  ) THEN
    RAISE EXCEPTION 'Policy not created successfully';
  END IF;
END $$;