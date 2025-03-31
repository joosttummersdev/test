/*
  # Make all customer fields optional

  1. Changes
    - Make all fields in customers table nullable except id and name fields
    - This allows storing basic customer information with just first_name and last_name
    - All other fields become optional for more flexible data entry

  2. Impact
    - Existing records are not affected
    - New records only require first_name and last_name
    - All other fields can be null
*/

-- Make all fields optional except id, first_name, and last_name
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN street DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN postal_code DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN house_number DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN notes DROP NOT NULL;