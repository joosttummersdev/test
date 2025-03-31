/*
  # Fix Profile Policies Recursion

  1. Changes
    - Drop existing policies that cause recursion
    - Create new policies using JWT claims instead of table queries
    - Maintain basic user access to own profile
    
  2. Security
    - Use JWT claims for role checks
    - Maintain row-level security
    - Keep user access to own profile data
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create simple policy for users to read their own profile
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Create admin policy using JWT claims to avoid recursion
CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'role' = '"admin"',
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role' = 'admin',
    false
  )
);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;

-- Ensure all profiles have a role set
UPDATE profiles
SET role = COALESCE(role, 'agent')
WHERE role IS NULL;