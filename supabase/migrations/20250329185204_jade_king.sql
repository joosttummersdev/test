/*
  # Verify Profile and Fix RLS Policy

  1. Changes
    - Check if specific profile exists
    - Drop all existing policies to prevent conflicts
    - Create simple, direct policy for profile access
    - Log profile verification results
    
  2. Security
    - Enable RLS
    - Allow users to read their own profile
    - Log verification results for debugging
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
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

-- Verify if specific profile exists and log result
DO $$
DECLARE
  profile_id uuid := '7135ea96-3847-4752-a4f9-3714bf8dc635';
  profile_exists boolean;
  profile_role text;
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = profile_id
  ) INTO profile_exists;

  -- Get role if profile exists
  IF profile_exists THEN
    SELECT role 
    FROM profiles 
    WHERE id = profile_id 
    INTO profile_role;
  END IF;

  -- Log results
  IF profile_exists THEN
    RAISE LOG 'Profile found - ID: %, Role: %', profile_id, profile_role;
  ELSE
    RAISE LOG 'Profile not found - ID: %', profile_id;
  END IF;
END $$;