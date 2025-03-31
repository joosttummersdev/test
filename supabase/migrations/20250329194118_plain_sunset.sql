/*
  # Add user-supplier assignments table

  1. New Tables
    - user_suppliers
      - user_id (uuid, references profiles.id)
      - supplier_id (uuid, references suppliers.id)
      - created_at (timestamptz)
      
  2. Changes
    - Drop supplier_id from profiles table
    - Create new junction table for many-to-many relationship
    - Add appropriate policies
*/

-- Create junction table for user-supplier assignments
CREATE TABLE user_suppliers (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id)
);

-- Enable RLS
ALTER TABLE user_suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage user suppliers"
ON user_suppliers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Migrate existing supplier assignments
INSERT INTO user_suppliers (user_id, supplier_id)
SELECT id, supplier_id
FROM profiles
WHERE supplier_id IS NOT NULL;

-- Remove supplier_id from profiles
ALTER TABLE profiles DROP COLUMN supplier_id;