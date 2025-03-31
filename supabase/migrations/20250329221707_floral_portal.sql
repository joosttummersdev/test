/*
  # Make address fields optional

  1. Changes
    - Make street, postal_code, and house_number columns nullable in customers table
    - This allows storing basic customer information without requiring address details

  2. Impact
    - Existing records are not affected
    - New records can be created with only name and optional contact information
*/

-- Make address fields nullable
ALTER TABLE customers ALTER COLUMN street DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN postal_code DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN house_number DROP NOT NULL;