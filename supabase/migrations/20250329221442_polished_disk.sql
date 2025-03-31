/*
  # Make date_of_birth optional in customers table

  1. Changes
    - Modifies the `date_of_birth` column in the `customers` table to be nullable
    - Existing records will be preserved
    - No data loss will occur

  2. Impact
    - Customer records can now be created without a date of birth
    - Existing records with date_of_birth will remain unchanged
*/

-- Make date_of_birth column nullable
ALTER TABLE customers ALTER COLUMN date_of_birth DROP NOT NULL;