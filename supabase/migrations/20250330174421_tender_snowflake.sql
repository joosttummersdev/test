/*
  # Give user both admin and agent roles

  1. Changes
    - Update user's role in profiles table to include both roles
    - Update user metadata to reflect both roles
    - Log role changes
    
  2. Security
    - Maintain audit trail of role changes
    - Update both profile and auth metadata
*/

DO $$ 
DECLARE
  user_id uuid;
  current_role text;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = 'joost@yoobar.nl';

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User with email joost@yoobar.nl not found';
  END IF;

  -- Get current role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = user_id;

  -- Update role in profiles table to include both roles
  UPDATE profiles
  SET 
    role = 'admin',  -- Set primary role as admin since it has more privileges
    updated_at = now()
  WHERE id = user_id;

  -- Update user metadata to include both roles
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_build_object(
      'role', 'admin',
      'roles', jsonb_build_array('admin', 'agent')
    ),
    raw_app_meta_data = jsonb_build_object(
      'role', 'admin',
      'roles', jsonb_build_array('admin', 'agent')
    ),
    updated_at = now()
  WHERE id = user_id;

  -- Log the role change
  INSERT INTO role_change_log (
    user_id,
    old_role,
    new_role,
    changed_by
  )
  VALUES (
    user_id,
    current_role,
    'admin',  -- Log the primary role change
    user_id
  );

  RAISE NOTICE 'Successfully updated roles to admin+agent for user %', user_id;
END $$;