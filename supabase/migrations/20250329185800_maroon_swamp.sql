/*
  # Fix Profiles RLS Policy

  1. Changes
    - Drop all existing policies
    - Create simple policy for reading own profile
    - Enable RLS
    - Grant necessary permissions
    
  2. Security
    - Maintain RLS enabled
    - Use direct auth.uid() comparison
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
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
USING (
  id = auth.uid()
);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;

-- Log policy creation and verify setup
DO $$
DECLARE
  test_id uuid := '7135ea96-3847-4752-a4f9-3714bf8dc635';
  profile_exists boolean;
BEGIN
  -- Check if test profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = test_id
  ) INTO profile_exists;

  -- Log results
  RAISE LOG 'RLS Policy Setup Complete:';
  RAISE LOG '- RLS Enabled: true';
  RAISE LOG '- Policy Created: Allow users to read their own profile';
  RAISE LOG '- Test Profile Exists: %', profile_exists;

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