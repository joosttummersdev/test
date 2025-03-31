/*
  # Fix admin role for user

  1. Changes
    - Update user role to admin in profiles table
    - Add role to auth.users metadata
    - Log role change
*/

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

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
    updated_at = now()
  WHERE id = user_id;

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