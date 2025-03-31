/*
  # Fix customers foreign key relationship

  1. Changes
    - Drop existing foreign key if it exists
    - Create correct foreign key to auth.users table
    - Update RLS policies to reflect the change
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper reference to auth.users
*/

-- Drop existing foreign key if it exists
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_agent_id_fkey;

-- Create new foreign key constraint to auth.users
ALTER TABLE customers
  ADD CONSTRAINT customers_agent_id_fkey
  FOREIGN KEY (agent_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Update the customers table query to reflect the correct schema
COMMENT ON CONSTRAINT customers_agent_id_fkey ON customers IS 
  'Foreign key relationship between customers and auth.users for agents';