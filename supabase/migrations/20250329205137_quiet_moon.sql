/*
  # Add Agent-Supplier Commission Management

  1. New Tables
    - agent_supplier_commissions
      - agent_id (uuid, references profiles)
      - supplier_id (uuid, references suppliers)
      - commission_rate (decimal)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create agent_supplier_commissions table
CREATE TABLE agent_supplier_commissions (
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  commission_rate decimal(5,2) NOT NULL CHECK (commission_rate >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id, supplier_id)
);

-- Enable RLS
ALTER TABLE agent_supplier_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage commissions"
ON agent_supplier_commissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_agent_commission_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_agent_commission_updated_at
  BEFORE UPDATE ON agent_supplier_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_commission_updated_at();