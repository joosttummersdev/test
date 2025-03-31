/*
  # Fix Profiles RLS Policies

  1. Changes
    - Drop existing RLS policies for profiles table
    - Create new policies that avoid recursive dependencies
    - Use auth.uid() directly instead of checking profiles table
    
  2. Security
    - Users can view their own profile
    - Admins can manage all profiles (using app_metadata)
    - Maintains row-level security
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Create policy for admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );