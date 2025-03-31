/*
  # Fix Suppliers RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Create new RLS policies with proper permissions
    - Add trigger for updated_at timestamp

  2. Security
    - Enable RLS on suppliers table
    - Allow admins to manage all suppliers
    - Allow authenticated users to view suppliers
*/

-- First ensure RLS is enabled
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;

-- Create policy for admin management
CREATE POLICY "Admins can manage suppliers"
ON suppliers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create policy for viewing suppliers
CREATE POLICY "Authenticated users can view suppliers"
ON suppliers
FOR SELECT
TO authenticated
USING (true);

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'set_suppliers_updated_at'
  ) THEN
    CREATE TRIGGER set_suppliers_updated_at
      BEFORE UPDATE ON suppliers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;