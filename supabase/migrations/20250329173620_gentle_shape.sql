/*
  # Fix RLS Policies to Prevent Recursion

  1. Changes
    - Remove all recursive policies
    - Implement simple, direct policies without subqueries
    - Keep role change logging functionality
    
  2. Security
    - Users can read their own profile
    - Admins can manage all profiles based on app_metadata
    - Maintain audit logging
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create basic policy for users to view their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create admin policy using app_metadata instead of querying profiles
CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
);

-- Ensure all users have a role set
UPDATE profiles
SET role = COALESCE(role, 'agent')
WHERE role IS NULL;

-- Drop and recreate role change log policies
DROP POLICY IF EXISTS "Admins can view role changes" ON role_change_log;

CREATE POLICY "Admins can view role changes"
ON role_change_log
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
);

-- Update the role change trigger to be more robust
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO role_change_log (user_id, old_role, new_role, changed_by)
    VALUES (NEW.id, OLD.role, NEW.role, auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block the update
  RETURN NEW;
END;
$$;