/*
  # Fix user trigger and profile creation
  
  1. Changes
    - Enhance trigger function with better error handling
    - Add detailed logging
    - Ensure trigger is properly installed
    - Fix potential race conditions
    
  2. Security
    - Maintain SECURITY DEFINER for proper permissions
*/

-- Drop existing trigger and function to ensure clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create enhanced trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Log function entry
  RAISE LOG 'handle_new_user() called for user ID: %, email: %', NEW.id, NEW.email;
  RAISE LOG 'User metadata: %', NEW.raw_user_meta_data;

  -- Check if profile exists using FOR UPDATE to prevent race conditions
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = NEW.id 
    FOR UPDATE
  ) INTO profile_exists;

  IF profile_exists THEN
    RAISE LOG 'Profile already exists for user ID: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Create profile with error handling
  BEGIN
    INSERT INTO public.profiles (
      id,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 
               NEW.raw_app_meta_data->>'role', 
               'agent'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
      now(),
      now()
    );

    RAISE LOG 'Successfully created profile for user ID: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log detailed error information
    RAISE WARNING 'Error creating profile for user ID %: % %', NEW.id, SQLERRM, SQLSTATE;
    -- Don't fail the transaction, but log the error
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;

-- Create trigger with proper timing and execution options
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger installation
DO $$
DECLARE
  trigger_exists boolean;
  function_exists boolean;
BEGIN
  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) INTO trigger_exists;

  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) INTO function_exists;

  -- Log verification results
  IF trigger_exists AND function_exists THEN
    RAISE LOG 'Trigger and function successfully installed';
  ELSE
    RAISE WARNING 'Installation verification failed. Trigger exists: %, Function exists: %', 
      trigger_exists, function_exists;
  END IF;
END $$;

-- Create missing profiles for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data, u.raw_app_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    BEGIN
      INSERT INTO public.profiles (
        id,
        role,
        first_name,
        last_name,
        created_at,
        updated_at
      ) VALUES (
        user_record.id,
        COALESCE(
          user_record.raw_user_meta_data->>'role',
          user_record.raw_app_meta_data->>'role',
          'agent'
        ),
        COALESCE(user_record.raw_user_meta_data->>'first_name', 'New'),
        COALESCE(user_record.raw_user_meta_data->>'last_name', 'User'),
        now(),
        now()
      );
      
      RAISE LOG 'Created missing profile for user ID: %', user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creating profile for existing user %: % %', 
        user_record.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;