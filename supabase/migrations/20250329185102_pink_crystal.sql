/*
  # Fix Profiles Table Policy

  1. Changes
    - Drop existing policies that may cause recursion
    - Create simple, direct policy for users to read their own profile
    - Remove complex role-based checks that cause recursion
    
  2. Security
    - Maintain row-level security
    - Allow users to read their own profile data
    - Keep basic security model intact
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create simple, direct policy for users to read their own profile
CREATE POLICY "Allow users to read their own profile"
ON profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;