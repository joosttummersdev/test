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

-- Ensure all profiles have a role set
UPDATE profiles
SET role = COALESCE(role, 'agent')
WHERE role IS NULL;