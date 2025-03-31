/*
  # Create proposition tiers and fees tables

  1. New Tables
    - proposition_tiers: Stores commission tiers for electricity and gas
    - proposition_fees: Stores fixed and variable fees for propositions

  2. Security
    - Enable RLS on both tables
    - Add admin-only policies

  3. Initial Data
    - Create Vattenfall business propositions
    - Add commission tiers for electricity and gas
    - Add fixed fees for all propositions
*/

-- Create proposition_tiers table
CREATE TABLE proposition_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposition_id uuid REFERENCES propositions(id) ON DELETE CASCADE,
  product_type text NOT NULL CHECK (product_type IN ('electricity', 'gas')),
  min_usage numeric(10,3) NOT NULL,
  max_usage numeric(10,3),
  commission_amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create proposition_fees table
CREATE TABLE proposition_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposition_id uuid REFERENCES propositions(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('fixed', 'variable')),
  product_type text NOT NULL CHECK (product_type IN ('electricity', 'gas')),
  amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE proposition_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposition_fees ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage proposition tiers"
ON proposition_tiers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can manage proposition fees"
ON proposition_fees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Insert Vattenfall Business Propositions
DO $$ 
DECLARE
  vattenfall_id uuid;
  business_project_id uuid;
  electricity_prop_id uuid;
  gas_1y_opslag1_id uuid;
  gas_1y_opslag2_id uuid;
  gas_3y_opslag1_id uuid;
  gas_3y_opslag2_id uuid;
BEGIN
  -- Get Vattenfall supplier ID
  SELECT id INTO vattenfall_id FROM suppliers WHERE name = 'Vattenfall';
  
  -- Get business project ID
  SELECT id INTO business_project_id 
  FROM projects 
  WHERE name = 'Vattenfall Zakelijk' 
  AND supplier_id = vattenfall_id;

  -- Insert propositions and store their IDs
  INSERT INTO propositions (project_id, name, commission, active)
  VALUES (business_project_id, 'Vattenfall Zakelijk Groen uit Nederland Vast', 0, true)
  RETURNING id INTO electricity_prop_id;

  INSERT INTO propositions (project_id, name, commission, active)
  VALUES (business_project_id, 'Vattenfall VastePrijsGas 1 jaar opslag 1', 0, true)
  RETURNING id INTO gas_1y_opslag1_id;

  INSERT INTO propositions (project_id, name, commission, active)
  VALUES (business_project_id, 'Vattenfall VastePrijsGas 1 jaar opslag 2', 0, true)
  RETURNING id INTO gas_1y_opslag2_id;

  INSERT INTO propositions (project_id, name, commission, active)
  VALUES (business_project_id, 'Vattenfall VastePrijsGas 3 jaar opslag 1', 0, true)
  RETURNING id INTO gas_3y_opslag1_id;

  INSERT INTO propositions (project_id, name, commission, active)
  VALUES (business_project_id, 'Vattenfall VastePrijsGas 3 jaar opslag 2', 0, true)
  RETURNING id INTO gas_3y_opslag2_id;

  -- Insert electricity tiers
  INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
  VALUES
    (electricity_prop_id, 'electricity', 0, 3000, 40.00),
    (electricity_prop_id, 'electricity', 3001, 5000, 40.00),
    (electricity_prop_id, 'electricity', 5001, 10000, 40.00),
    (electricity_prop_id, 'electricity', 10001, 25000, 75.00),
    (electricity_prop_id, 'electricity', 25001, 50000, 75.00),
    (electricity_prop_id, 'electricity', 50001, 75000, 75.00),
    (electricity_prop_id, 'electricity', 75001, 100000, 75.00),
    (electricity_prop_id, 'electricity', 100001, NULL, 75.00);

  -- Insert gas tiers for each gas proposition
  INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
  SELECT proposition_id, 'gas', min_usage, max_usage, commission_amount
  FROM (
    VALUES
      (gas_1y_opslag1_id, 0, 1500, 40.00),
      (gas_1y_opslag1_id, 1501, 2500, 40.00),
      (gas_1y_opslag1_id, 2501, 5000, 40.00),
      (gas_1y_opslag1_id, 5001, 7500, 75.00),
      (gas_1y_opslag1_id, 7501, 10000, 75.00),
      (gas_1y_opslag1_id, 10001, 15000, 75.00),
      (gas_1y_opslag1_id, 15001, 25000, 75.00),
      (gas_1y_opslag1_id, 25001, NULL, 75.00),
      (gas_1y_opslag2_id, 0, 1500, 40.00),
      (gas_1y_opslag2_id, 1501, 2500, 40.00),
      (gas_1y_opslag2_id, 2501, 5000, 40.00),
      (gas_1y_opslag2_id, 5001, 7500, 75.00),
      (gas_1y_opslag2_id, 7501, 10000, 75.00),
      (gas_1y_opslag2_id, 10001, 15000, 75.00),
      (gas_1y_opslag2_id, 15001, 25000, 75.00),
      (gas_1y_opslag2_id, 25001, NULL, 75.00),
      (gas_3y_opslag1_id, 0, 1500, 40.00),
      (gas_3y_opslag1_id, 1501, 2500, 40.00),
      (gas_3y_opslag1_id, 2501, 5000, 40.00),
      (gas_3y_opslag1_id, 5001, 7500, 75.00),
      (gas_3y_opslag1_id, 7501, 10000, 75.00),
      (gas_3y_opslag1_id, 10001, 15000, 75.00),
      (gas_3y_opslag1_id, 15001, 25000, 75.00),
      (gas_3y_opslag1_id, 25001, NULL, 75.00),
      (gas_3y_opslag2_id, 0, 1500, 40.00),
      (gas_3y_opslag2_id, 1501, 2500, 40.00),
      (gas_3y_opslag2_id, 2501, 5000, 40.00),
      (gas_3y_opslag2_id, 5001, 7500, 75.00),
      (gas_3y_opslag2_id, 7501, 10000, 75.00),
      (gas_3y_opslag2_id, 10001, 15000, 75.00),
      (gas_3y_opslag2_id, 15001, 25000, 75.00),
      (gas_3y_opslag2_id, 25001, NULL, 75.00)
  ) AS t(proposition_id, min_usage, max_usage, commission_amount);

  -- Insert fixed fees for all propositions
  INSERT INTO proposition_fees (proposition_id, fee_type, product_type, amount)
  SELECT id, 'fixed', 'electricity', 5.00
  FROM propositions
  WHERE project_id = business_project_id;

  INSERT INTO proposition_fees (proposition_id, fee_type, product_type, amount)
  SELECT id, 'fixed', 'gas', 5.00
  FROM propositions
  WHERE project_id = business_project_id;

END $$;