/*
  # Fix Profiles RLS Policies

  1. Changes
    - Drop existing policies that cause recursion
    - Create new policies using JWT claims instead of self-referential queries
    - Maintain basic security model
    
  2. Security
    - Users can read their own profile
    - Admins can manage all profiles
    - Use JWT claims to avoid recursion
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

-- Create policy for users to read their own profile
CREATE POLICY "allow_read_own_profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Create policy for admins using JWT claims
CREATE POLICY "allow_admin_full_access"
ON profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role')::text = 'admin' OR
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;