/*
  # Fix user display and add email field

  1. Changes
    - Add email field to profiles table if not exists
    - Create index on email field
    - Update existing profiles with email from auth.users
    - Add trigger to sync email on user updates
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add email field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Create index on email if it doesn't exist
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- Update existing profiles with email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- Create trigger function to sync email on user updates
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email <> OLD.email THEN
    UPDATE profiles
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for email sync
DROP TRIGGER IF EXISTS sync_user_email_trigger ON auth.users;
CREATE TRIGGER sync_user_email_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION sync_user_email();