/*
  # Fix customers and profiles relationship

  1. Changes
    - Drop existing foreign key constraint from customers to auth.users
    - Add new foreign key constraint from customers to profiles
    - Update comments and documentation
    
  2. Security
    - Maintain existing RLS policies
    - Ensure referential integrity
*/

-- Drop existing foreign key if it exists
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_agent_id_fkey;

-- Create new foreign key constraint to profiles
ALTER TABLE customers
  ADD CONSTRAINT customers_agent_id_fkey
  FOREIGN KEY (agent_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- Update the customers table query to reflect the correct schema
COMMENT ON CONSTRAINT customers_agent_id_fkey ON customers IS 
  'Foreign key relationship between customers and profiles for agents';