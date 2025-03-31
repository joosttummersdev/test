/*
  # Make address fields optional

  1. Changes
    - Make street, postal_code, and house_number fields optional in customers table
    - This allows storing basic customer info without requiring address details

  2. Impact
    - Existing records are unaffected
    - New records can be created without address information
*/

-- Make address fields optional if not already done
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'street' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE customers ALTER COLUMN street DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'postal_code' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE customers ALTER COLUMN postal_code DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'house_number' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE customers ALTER COLUMN house_number DROP NOT NULL;
  END IF;
END $$;