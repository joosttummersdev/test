/*
  # Update Suppliers RLS Policies

  1. Changes
    - Drop existing RLS policies for suppliers table
    - Create new policies for admin management and authenticated user viewing
    
  2. Security
    - Admins can perform all operations on suppliers
    - All authenticated users can view suppliers
    - Maintains row-level security
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;

-- Create policy for admin management
CREATE POLICY "Admins can manage suppliers" ON suppliers
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policy for authenticated users to view suppliers
CREATE POLICY "Authenticated users can view suppliers" ON suppliers
  FOR SELECT
  TO authenticated
  USING (true);