/*
  # Fix Profile Access and RLS

  1. Changes
    - Drop all existing policies for a clean slate
    - Create simple policy for profile access
    - Enable RLS
    - Verify setup and profile existence
    
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

-- Create simple policy for profile access
CREATE POLICY "Allow user to read own profile"
ON profiles
FOR SELECT
USING (id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;

-- Verify profile exists and create if missing
DO $$
DECLARE
  admin_id uuid := '29bf0345-9684-4e0f-bda4-92adc3a84d78';
  profile_exists boolean;
  profile_role text;
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = admin_id
  ), role INTO profile_exists, profile_role
  FROM profiles WHERE id = admin_id;

  -- Log results
  RAISE LOG 'Profile Check Results:';
  RAISE LOG '- Profile ID: %', admin_id;
  RAISE LOG '- Profile Exists: %', profile_exists;
  RAISE LOG '- Profile Role: %', profile_role;
  RAISE LOG '- RLS Enabled: true';
  RAISE LOG '- Policy Created: Allow user to read own profile';

  -- Create profile if missing
  IF NOT profile_exists THEN
    INSERT INTO profiles (
      id,
      role,
      first_name,
      last_name
    ) VALUES (
      admin_id,
      'admin',
      'Joost',
      'Admin'
    );
    RAISE LOG '- Created missing admin profile';
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
    AND policyname = 'Allow user to read own profile'
  ) THEN
    RAISE EXCEPTION 'Policy not created successfully';
  END IF;
END $$;