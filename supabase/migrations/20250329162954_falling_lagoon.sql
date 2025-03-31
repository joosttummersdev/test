/*
  # Fix Role Assignment and RLS Policies

  1. Changes
    - Add missing RLS policies for profiles table
    - Update existing profiles to ensure role is set
    - Add policy for users to read their own profile data
    - Add logging for debugging

  2. Security
    - Maintain existing RLS
    - Add specific policy for profile role access
*/

-- First, ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
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

-- Update any profiles with NULL roles to 'agent'
UPDATE profiles 
SET role = 'agent' 
WHERE role IS NULL;

-- Create a function to validate profile access
CREATE OR REPLACE FUNCTION check_profile_access(profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    -- User can access their own profile
    profile_id = auth.uid()
    OR
    -- Admins can access any profile
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
END;
$$;

-- Add logging table for debugging
CREATE TABLE IF NOT EXISTS auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on auth_logs
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view auth logs
CREATE POLICY "Admins can view auth logs"
ON auth_logs
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

-- Create function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id uuid,
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO auth_logs (user_id, event_type, details)
  VALUES (p_user_id, p_event_type, p_details);
END;
$$;

-- Log current role assignments for verification
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      p.id,
      p.role,
      p.first_name,
      p.last_name,
      u.email
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
  LOOP
    PERFORM log_auth_event(
      r.id,
      'ROLE_VERIFICATION',
      jsonb_build_object(
        'role', r.role,
        'email', r.email,
        'first_name', r.first_name,
        'last_name', r.last_name
      )
    );
  END LOOP;
END;
$$;