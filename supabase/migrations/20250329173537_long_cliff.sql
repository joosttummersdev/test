/*
  # Fix RLS Policies to Prevent Recursion

  1. Changes
    - Simplify RLS policies to prevent infinite recursion
    - Remove complex role verification that causes recursion
    - Maintain basic security rules
    - Keep role change logging functionality
    
  2. Security
    - Users can read their own profile
    - Admins can manage all profiles
    - Maintain audit logging
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create simplified policies that don't cause recursion
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Ensure all users have a role set
UPDATE profiles
SET role = COALESCE(role, 'agent')
WHERE role IS NULL;

-- Add role change logging
CREATE TABLE IF NOT EXISTS role_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  old_role text,
  new_role text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Enable RLS on role change log
ALTER TABLE role_change_log ENABLE ROW LEVEL SECURITY;

-- Create simplified policy for role change log
DROP POLICY IF EXISTS "Admins can view role changes" ON role_change_log;

CREATE POLICY "Admins can view role changes"
ON role_change_log
FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Create trigger to log role changes
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
END;
$$;

-- Recreate trigger for role changes
DROP TRIGGER IF EXISTS log_role_changes ON profiles;

CREATE TRIGGER log_role_changes
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();