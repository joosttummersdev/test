/*
  # Fix Profiles RLS Policy

  1. Changes
    - Drop all existing policies on profiles table
    - Enable RLS
    - Create simple policy for reading own profile
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

-- Create simple, direct policy for users to read their own profile
CREATE POLICY "Allow users to read their own profile"
ON profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;

-- Log policy creation for verification
DO $$
BEGIN
  RAISE LOG 'Profiles RLS policy created successfully';
  
  -- Verify RLS is enabled
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE tablename = 'profiles'
    AND rowsecurity = true
  ) THEN
    RAISE LOG 'RLS is enabled on profiles table';
  ELSE
    RAISE WARNING 'RLS is NOT enabled on profiles table';
  END IF;
  
  -- Verify policy exists
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Allow users to read their own profile'
  ) THEN
    RAISE LOG 'Policy "Allow users to read their own profile" exists';
  ELSE
    RAISE WARNING 'Policy "Allow users to read their own profile" does NOT exist';
  END IF;
END $$;