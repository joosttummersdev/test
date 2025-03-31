/*
  # Fix Role Assignment and Verification

  1. Changes
    - Update existing profiles to ensure role is set
    - Add role verification function
    - Update RLS policies to use role verification
    - Add logging for role changes

  2. Security
    - Maintain RLS policies
    - Add role verification
*/

-- Create role verification function
CREATE OR REPLACE FUNCTION public.verify_user_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id
    AND role = required_role
  );
END;
$$;

-- Drop existing policy before recreating
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create new policy using role verification
CREATE POLICY "Admins can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (verify_user_role(auth.uid(), 'admin'))
  WITH CHECK (verify_user_role(auth.uid(), 'admin'));

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

-- Drop existing policy before recreating
DROP POLICY IF EXISTS "Admins can view role changes" ON role_change_log;

-- Create policy for role change log
CREATE POLICY "Admins can view role changes"
  ON role_change_log
  FOR ALL
  TO authenticated
  USING (verify_user_role(auth.uid(), 'admin'));

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

-- Drop existing trigger before recreating
DROP TRIGGER IF EXISTS log_role_changes ON profiles;

-- Create trigger for role changes
CREATE TRIGGER log_role_changes
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();