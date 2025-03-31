/*
  # Fix Profile RLS Policy and Access

  1. Changes
    - Drop existing policies
    - Create correct policy for profile access
    - Enable RLS
    - Verify profile exists
    
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
DROP POLICY IF EXISTS "Allow user to read own profile" ON profiles;

-- Create the correct policy
CREATE POLICY "Allow user to read own profile"
ON profiles
FOR SELECT
USING (id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;

-- Verify profile exists and log results
DO $$
DECLARE
  profile_exists boolean;
  profile_role text;
  profile_id uuid;
BEGIN
  -- Get session user ID
  profile_id := auth.uid();
  
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = profile_id
  ), role INTO profile_exists, profile_role
  FROM profiles WHERE id = profile_id;

  -- Log results
  RAISE LOG 'Profile Check Results:';
  RAISE LOG '- Profile ID: %', profile_id;
  RAISE LOG '- Profile Exists: %', profile_exists;
  RAISE LOG '- Profile Role: %', profile_role;
  RAISE LOG '- RLS Enabled: true';
  RAISE LOG '- Policy Created: Allow user to read own profile';

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
    AND policyname = 'Allow user to read own profile'
  ) THEN
    RAISE EXCEPTION 'Policy not created successfully';
  END IF;
END $$;