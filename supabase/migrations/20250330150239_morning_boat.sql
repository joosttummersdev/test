/*
  # Fix profiles table RLS policies

  1. Changes
    - Drop all existing policies to ensure clean slate
    - Create new policy for users to read their own profile
    - Enable RLS on profiles table
    
  2. Security
    - Users can only read their own profile
    - Uses direct auth.uid() comparison
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
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;

-- Create policy for users to read their own profile
CREATE POLICY "Allow users to select their own profile"
ON profiles
FOR SELECT
USING (id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;