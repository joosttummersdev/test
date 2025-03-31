/*
  # Fix User Profile Creation Trigger

  1. Changes
    - Drop trigger first to avoid dependency issues
    - Drop and recreate function with improved profile handling
    - Add better error handling and logging
    
  2. Security
    - Maintain SECURITY DEFINER
    - Keep existing permissions
*/

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

-- Now we can safely drop and recreate the function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log function entry
  RAISE LOG 'handle_new_user() called for user ID: %, email: %', NEW.id, NEW.email;
  RAISE LOG 'User metadata: %', NEW.raw_user_meta_data;

  -- Insert or update profile
  INSERT INTO public.profiles (
    id,
    role,
    first_name,
    last_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      NEW.raw_app_meta_data->>'role',
      'agent'
    ),
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  RAISE LOG 'Profile created/updated successfully for user ID: %', NEW.id;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();