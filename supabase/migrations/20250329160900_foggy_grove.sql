/*
  # Verify and enhance user trigger function
  
  1. Changes
    - Add detailed logging to trigger function
    - Verify trigger exists and is correctly configured
    - Add test case for trigger functionality
    
  2. Security
    - No changes to security policies
*/

-- First verify if the trigger exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'Trigger "on_auth_user_created" does not exist!';
  ELSE
    RAISE NOTICE 'Trigger "on_auth_user_created" exists';
  END IF;
END $$;

-- Enhance the trigger function with logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Log the incoming data
  RAISE NOTICE 'handle_new_user() called for user ID: %, email: %', NEW.id, NEW.email;
  RAISE NOTICE 'User metadata: %', NEW.raw_user_meta_data;

  -- Check if profile already exists
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  ) THEN
    RAISE NOTICE 'Profile already exists for user ID: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Create the profile
  BEGIN
    INSERT INTO public.profiles (
      id,
      role,
      first_name,
      last_name
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'agent'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User')
    );
    RAISE NOTICE 'Successfully created profile for user ID: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log any errors that occur
    RAISE NOTICE 'Error creating profile: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is correctly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test the trigger with a dummy user (will be rolled back)
DO $$ 
DECLARE
  test_user_id uuid;
BEGIN
  -- Start a transaction that we'll roll back
  BEGIN
    -- Create a test user
    INSERT INTO auth.users (
      id,
      email,
      raw_user_meta_data
    ) VALUES (
      gen_random_uuid(),
      'test@example.com',
      jsonb_build_object(
        'role', 'agent',
        'first_name', 'Test',
        'last_name', 'User'
      )
    )
    RETURNING id INTO test_user_id;

    -- Verify profile was created
    IF EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = test_user_id
    ) THEN
      RAISE NOTICE 'Test successful: Profile was created automatically';
    ELSE
      RAISE NOTICE 'Test failed: Profile was not created';
    END IF;

    -- Rollback the test
    RAISE EXCEPTION 'Rolling back test';
  EXCEPTION 
    WHEN OTHERS THEN
      IF SQLERRM = 'Rolling back test' THEN
        RAISE NOTICE 'Test completed and rolled back successfully';
      ELSE
        RAISE NOTICE 'Unexpected error during test: % %', SQLERRM, SQLSTATE;
      END IF;
  END;
END $$;