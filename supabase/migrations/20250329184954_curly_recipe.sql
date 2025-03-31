/*
  # Fix Profile Access Policies

  1. Changes
    - Drop existing policies to ensure clean slate
    - Create simple, direct policies for profile access
    - Ensure authenticated users can read their own profile
    - Allow admins to manage all profiles
    
  2. Security
    - Maintain row-level security
    - Use direct auth.uid() comparison for user access
*/

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create simple policy for users to read their own profile
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Create policy for admins to manage all profiles
CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;

-- Verify existing profiles have roles set
UPDATE profiles
SET role = COALESCE(role, 'agent')
WHERE role IS NULL;