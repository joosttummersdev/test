/*
  # Setup User Profile Handling

  1. Changes
    - Create function to handle new user signups
    - Create trigger for automatic profile creation
    - Add proper error handling and checks
    
  2. Security
    - Function runs with SECURITY DEFINER
    - Only creates profiles for valid users
*/

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Only create profile if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  ) THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the foreign key constraint is correct
DO $$ 
BEGIN
  -- Drop the constraint if it exists
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  
  -- Recreate the constraint
  ALTER TABLE profiles 
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
END $$;