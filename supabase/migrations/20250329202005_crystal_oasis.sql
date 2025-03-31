/*
  # Add email field to profiles table

  1. Changes
    - Add email column to profiles table
    - Update existing profiles with email from auth.users
    - Add index on email column
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Create index on email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- Update existing profiles with email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;