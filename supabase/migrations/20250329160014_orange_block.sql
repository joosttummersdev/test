/*
  # Check and fix profiles foreign key constraint

  1. Changes
    - Check if profiles_id_fkey constraint exists and points to auth.users
    - Only recreate the constraint if it's incorrect
    - Add detailed logging for debugging

  2. Security
    - No changes to security policies
*/

DO $$ 
DECLARE
  constraint_info RECORD;
BEGIN
  -- Get current constraint information
  SELECT 
    tc.table_schema as schema_name,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_schema_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  INTO constraint_info
  FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_name = 'profiles_id_fkey'
  AND tc.table_schema = 'public';

  -- Log the current constraint configuration
  RAISE NOTICE 'Current constraint configuration: %', constraint_info;

  -- Only update if the constraint is incorrect or doesn't exist
  IF constraint_info.constraint_name IS NULL OR
     constraint_info.foreign_schema_name != 'auth' OR
     constraint_info.foreign_table_name != 'users' THEN
    
    -- Drop existing constraint if it exists
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey';
    
    -- Create the correct constraint
    EXECUTE 'ALTER TABLE public.profiles 
            ADD CONSTRAINT profiles_id_fkey 
            FOREIGN KEY (id) 
            REFERENCES auth.users(id) 
            ON DELETE CASCADE';
            
    RAISE NOTICE 'Constraint updated to reference auth.users';
  ELSE
    RAISE NOTICE 'Constraint is already correctly configured';
  END IF;

END $$;