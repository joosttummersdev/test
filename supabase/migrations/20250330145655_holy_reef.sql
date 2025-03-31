/*
  # Fix profiles table RLS policy

  1. Changes
    - Enable RLS on profiles table
    - Add policy for users to read their own profile
    - Add policy for admins to manage all profiles
    
  2. Security
    - Users can only read their own profile
    - Admins can manage all profiles
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
DROP POLICY IF EXISTS "Allow user to read own profile" ON profiles;
DROP POLICY IF EXISTS "allow_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_admin_full_access" ON profiles;
DROP POLICY IF EXISTS "Allow logged-in users to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow user to read their own profile" ON profiles;

-- Create policy for users to read their own profile
CREATE POLICY "Allow user to read their own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Create policy for admins to manage all profiles
CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;