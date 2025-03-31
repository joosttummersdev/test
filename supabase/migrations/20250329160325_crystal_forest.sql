/*
  # Fix user profile setup

  1. Changes
    - Remove direct auth schema modifications
    - Focus on public schema profile management
    - Ensure admin profile exists
    
  2. Security
    - Maintain existing RLS policies
    - Keep foreign key relationship to auth.users
*/

-- Ensure admin profile exists and is properly configured
DO $$ 
DECLARE
  admin_user_id uuid := '29bf0345-9684-4e0f-bda4-92adc3a84d78';
  user_exists boolean;
  profile_exists boolean;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = admin_user_id
  ) INTO user_exists;

  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = admin_user_id
  ) INTO profile_exists;

  -- If user exists but profile doesn't, create it
  IF user_exists AND NOT profile_exists THEN
    INSERT INTO public.profiles (
      id,
      role,
      first_name,
      last_name
    ) VALUES (
      admin_user_id,
      'admin',
      'Joost',
      'Admin'
    );
  END IF;

  -- Update existing profile if needed
  IF profile_exists THEN
    UPDATE public.profiles
    SET 
      role = 'admin',
      first_name = COALESCE(first_name, 'Joost'),
      last_name = COALESCE(last_name, 'Admin'),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;
END $$;