/*
  # Verify and fix admin profile setup

  1. Changes
    - Verify admin user exists in auth.users
    - Ensure profile exists with correct ID
    - Add detailed logging for debugging
    - Fix any missing profile data
*/

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

  RAISE NOTICE 'Auth user exists: %, Profile exists: %', user_exists, profile_exists;

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
    RAISE NOTICE 'Created missing profile for admin user';
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
    RAISE NOTICE 'Updated existing admin profile';
  END IF;

  -- Verify the foreign key constraint
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'profiles' 
    AND tc.constraint_name = 'profiles_id_fkey'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
  ) THEN
    RAISE NOTICE 'Foreign key constraint is not correctly configured';
    
    -- Drop and recreate the constraint
    ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Recreated foreign key constraint';
  END IF;

END $$;