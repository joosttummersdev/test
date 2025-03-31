/*
  # Initial CRM System Schema

  1. New Tables
    - suppliers (leveranciers)
      - id: Primary key
      - name: Supplier name
      - description: Optional description
      - commission: Commission per sale
      - created_at: Timestamp
      - updated_at: Timestamp
    
    - customers (klanten)
      - id: Primary key
      - first_name: First name
      - last_name: Last name
      - email: Email address
      - street: Street name
      - postal_code: Postal code
      - house_number: House number
      - date_of_birth: Date of birth
      - phone: Optional phone number
      - notes: Optional notes
      - agent_id: Reference to auth.users
      - created_at: Timestamp
      - updated_at: Timestamp

    - sales
      - id: Primary key
      - agent_id: Reference to auth.users
      - supplier_id: Reference to suppliers
      - customer_id: Reference to customers
      - gross_amount: Amount supplier pays
      - agent_commission: Agent's commission
      - sale_date: Date of sale
      - created_at: Timestamp
      - updated_at: Timestamp

    - profiles (extended)
      - id: Reference to auth.users
      - role: User role (admin/agent)
      - first_name: First name
      - last_name: Last name
      - supplier_id: Reference to suppliers (for agents)
      - commission_rate: Agent's commission rate
      - created_at: Timestamp
      - updated_at: Timestamp

  2. Security
    - Enable RLS on all tables
    - Create appropriate policies for admin and agent access
*/

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  commission decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  street text NOT NULL,
  postal_code text NOT NULL,
  house_number text NOT NULL,
  date_of_birth date NOT NULL,
  phone text,
  notes text,
  agent_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES auth.users(id) NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  gross_amount decimal(10,2) NOT NULL,
  agent_commission decimal(10,2) NOT NULL,
  sale_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'agent',
  first_name text NOT NULL,
  last_name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  commission_rate decimal(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
CREATE POLICY "Admins can manage suppliers"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Customers policies
CREATE POLICY "Admins can manage all customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Agents can view and manage their customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid());

-- Sales policies
CREATE POLICY "Admins can manage all sales"
  ON sales
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Agents can view their own sales"
  ON sales
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create sales"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid()
    AND p2.role = 'admin'
  ));