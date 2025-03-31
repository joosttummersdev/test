/*
  # Make date_of_birth nullable
  
  1. Changes
    - Makes the date_of_birth column in customers table nullable
    - This allows customers to be created without a birth date
  
  2. Reason
    - Some customers may not have birth date information available
    - Prevents upload failures when birth date is missing or invalid
*/

ALTER TABLE customers ALTER COLUMN date_of_birth DROP NOT NULL;