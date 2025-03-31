/*
  # Add Salesdock Scraper Tables

  1. New Tables
    - scraper_configs: Store scraper settings and credentials
    - scraper_runs: Track scraping job history
    - scraper_results: Store raw scraped data
    
  2. Security
    - Enable RLS
    - Admin-only access
*/

-- Create scraper_configs table
CREATE TABLE scraper_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  credentials jsonb NOT NULL,
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_type CHECK (type IN ('salesdock'))
);

-- Create scraper_runs table
CREATE TABLE scraper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  stats jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Create scraper_results table
CREATE TABLE scraper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES scraper_runs(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb NOT NULL,
  processed boolean DEFAULT false,
  error text,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_type CHECK (type IN ('sale', 'offer', 'customer'))
);

-- Enable RLS
ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_results ENABLE ROW LEVEL SECURITY;

-- Create admin-only policies
CREATE POLICY "Admins can manage scraper configs"
  ON scraper_configs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage scraper runs"
  ON scraper_runs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage scraper results"
  ON scraper_results
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));

-- Add indexes
CREATE INDEX idx_scraper_runs_config ON scraper_runs(config_id);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX idx_scraper_results_run ON scraper_results(run_id);
CREATE INDEX idx_scraper_results_type ON scraper_results(type);
CREATE INDEX idx_scraper_results_processed ON scraper_results(processed);