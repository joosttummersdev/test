/*
  # Add Scraper Environments Support

  1. Changes
    - Add environments table for scraper configurations
    - Add environment_type enum for different portals
    - Add relationship between configs and environments
    
  2. Security
    - Maintain admin-only access
    - Enable RLS on new tables
*/

-- Create environment types enum
CREATE TYPE scraper_environment_type AS ENUM (
  'hostedenergy',
  'salesdock'
);

-- Create environments table
CREATE TABLE scraper_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  name text NOT NULL,
  type scraper_environment_type NOT NULL,
  credentials jsonb NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Add constraints
  CONSTRAINT valid_credentials CHECK (
    (type = 'hostedenergy' AND 
     credentials ? 'username' AND 
     credentials ? 'password' AND
     jsonb_typeof(credentials->'username') = 'string' AND
     jsonb_typeof(credentials->'password') = 'string' AND
     (credentials->>'username') IS NOT NULL AND
     (credentials->>'username') != '' AND
     (credentials->>'password') IS NOT NULL AND
     (credentials->>'password') != ''
    ) OR
    (type = 'salesdock' AND 
     credentials ? 'username' AND 
     credentials ? 'password' AND
     jsonb_typeof(credentials->'username') = 'string' AND
     jsonb_typeof(credentials->'password') = 'string' AND
     (credentials->>'username') IS NOT NULL AND
     (credentials->>'username') != '' AND
     (credentials->>'password') IS NOT NULL AND
     (credentials->>'password') != ''
    )
  )
);

-- Create scraper results table for storing transaction data
CREATE TABLE scraper_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES scraper_runs(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES scraper_environments(id),
  transaction_id text NOT NULL,
  transaction_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  error text,
  created_at timestamptz DEFAULT now(),
  
  -- Add constraints
  CONSTRAINT unique_transaction_per_env UNIQUE (environment_id, transaction_id)
);

-- Enable RLS
ALTER TABLE scraper_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_transactions ENABLE ROW LEVEL SECURITY;

-- Create admin-only policies
CREATE POLICY "admin_access"
ON scraper_environments
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "admin_access"
ON scraper_transactions
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add indexes
CREATE INDEX idx_scraper_environments_config ON scraper_environments(config_id);
CREATE INDEX idx_scraper_transactions_run ON scraper_transactions(run_id);
CREATE INDEX idx_scraper_transactions_env ON scraper_transactions(environment_id);
CREATE INDEX idx_scraper_transactions_processed ON scraper_transactions(processed);