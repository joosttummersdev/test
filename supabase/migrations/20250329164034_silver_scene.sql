/*
  # Fix profile access policies

  1. Changes
    - Simplify RLS policies for profiles table
    - Ensure authenticated users can read their own profile
    - Allow admins to read all profiles
    - Add policy for profile updates
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create new policies
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Admins can manage all profiles"
ON profiles FOR ALL
TO authenticated
USING (
  role = 'admin'
);

-- Ensure the role column is accessible
GRANT SELECT ON profiles TO authenticated;