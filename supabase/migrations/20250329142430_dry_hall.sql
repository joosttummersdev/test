/*
  # Create projects and propositions tables

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `supplier_id` (uuid, foreign key to suppliers)
      - `type` (text - 'business' or 'consumer')
      - `description` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `propositions`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `name` (text)
      - `commission` (decimal)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for admin access
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  type text NOT NULL CHECK (type IN ('business', 'consumer')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create propositions table
CREATE TABLE IF NOT EXISTS propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  commission decimal(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Admins can manage projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Create policies for propositions
CREATE POLICY "Admins can manage propositions"
  ON propositions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Insert example data
INSERT INTO projects (name, supplier_id, type, description) 
SELECT 
  'Vattenfall Zakelijk',
  id,
  'business',
  'Zakelijke energiecontracten van Vattenfall'
FROM suppliers 
WHERE name = 'Vattenfall'
ON CONFLICT DO NOTHING;

INSERT INTO projects (name, supplier_id, type, description)
SELECT 
  'Vattenfall Particulier',
  id,
  'consumer',
  'Particuliere energiecontracten van Vattenfall'
FROM suppliers
WHERE name = 'Vattenfall'
ON CONFLICT DO NOTHING;

-- Add example propositions
DO $$ 
DECLARE
  vattenfall_business_id uuid;
  vattenfall_consumer_id uuid;
BEGIN
  SELECT id INTO vattenfall_business_id FROM projects WHERE name = 'Vattenfall Zakelijk';
  SELECT id INTO vattenfall_consumer_id FROM projects WHERE name = 'Vattenfall Particulier';
  
  IF vattenfall_business_id IS NOT NULL THEN
    INSERT INTO propositions (project_id, name, commission) VALUES
      (vattenfall_business_id, 'Stroom + Gas vast', 80.00),
      (vattenfall_business_id, 'Alleen stroom', 60.00)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF vattenfall_consumer_id IS NOT NULL THEN
    INSERT INTO propositions (project_id, name, commission) VALUES
      (vattenfall_consumer_id, '2 jaar combi', 60.00)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;