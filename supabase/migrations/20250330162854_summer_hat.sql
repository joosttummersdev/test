/*
  # Update User Role to Admin

  1. Changes
    - Update role to 'admin' for specific user
    - Ensure user exists in profiles table
    - Add logging for verification
    
  2. Security
    - No changes to security policies
    - Maintains existing permissions
*/

-- Update user role to admin
DO $$ 
DECLARE
  user_id uuid;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = 'joost.tummers@hotmail.com';

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User with email joost.tummers@hotmail.com not found';
  END IF;

  -- Update role in profiles table
  UPDATE profiles
  SET 
    role = 'admin',
    updated_at = now()
  WHERE id = user_id;

  -- Verify update
  IF NOT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = user_id 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Failed to update user role';
  END IF;

  -- Log the change
  INSERT INTO role_change_log (
    user_id,
    old_role,
    new_role,
    changed_by
  )
  SELECT
    user_id,
    'agent',
    'admin',
    user_id;

  RAISE NOTICE 'Successfully updated role to admin for user %', user_id;
END $$;