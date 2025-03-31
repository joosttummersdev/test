/*
  # Fix profile creation with UPSERT

  1. Changes
    - Drop existing trigger first
    - Drop and recreate function with UPSERT logic
    - Recreate trigger
    - Add detailed logging
    
  2. Security
    - Maintain existing RLS policies
    - Keep security definer on function
*/

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create enhanced trigger function with UPSERT
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