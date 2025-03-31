/*
  # Fix Scraper Configuration Tables

  1. Changes
    - Drop existing tables to ensure clean slate
    - Recreate tables with proper constraints
    - Add better JSON validation
    - Fix RLS policies
    
  2. Security
    - Maintain admin-only access
    - Add proper foreign key constraints
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS scraper_logs CASCADE;
DROP TABLE IF EXISTS scraper_runs CASCADE;
DROP TABLE IF EXISTS scraper_configs CASCADE;

-- Create scraper_configs table with JSON validation
CREATE TABLE scraper_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  credentials jsonb NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Add constraints
  CONSTRAINT valid_type CHECK (type IN ('salesdock')),
  CONSTRAINT valid_credentials CHECK (
    (type = 'salesdock' AND 
     credentials ? 'username' AND 
     credentials ? 'password' AND
     credentials->>'username' IS NOT NULL AND
     credentials->>'username' != '' AND
     credentials->>'password' IS NOT NULL AND
     credentials->>'password' != ''
    )
  )
);

-- Create scraper_runs table
CREATE TABLE scraper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Create scraper_logs table
CREATE TABLE scraper_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES scraper_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_level CHECK (level IN ('debug', 'info', 'warning', 'error'))
);

-- Enable RLS
ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage scraper configs" ON scraper_configs;
DROP POLICY IF EXISTS "Admins can manage scraper runs" ON scraper_runs;
DROP POLICY IF EXISTS "Admins can manage scraper logs" ON scraper_logs;

-- Create admin-only policies using JWT claims
CREATE POLICY "Admins can manage scraper configs"
  ON scraper_configs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can manage scraper runs"
  ON scraper_runs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can manage scraper logs"
  ON scraper_logs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- Add indexes
CREATE INDEX idx_scraper_runs_config ON scraper_runs(config_id);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX idx_scraper_logs_run ON scraper_logs(run_id);
CREATE INDEX idx_scraper_logs_level ON scraper_logs(level);