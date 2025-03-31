/*
  # Fix profiles table RLS policy

  1. Changes
    - Add RLS policy to allow users to read their own profile
    - Enable RLS on profiles table if not already enabled
    
  2. Security
    - Users can only read their own profile data
    - Uses direct auth.uid() comparison for security
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

-- Create policy for users to read their own profile
CREATE POLICY "Allow logged-in users to read their own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;