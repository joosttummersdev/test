-- Drop existing tables if they exist
DROP TABLE IF EXISTS scraper_logs CASCADE;
DROP TABLE IF EXISTS scraper_runs CASCADE;
DROP TABLE IF EXISTS scraper_configs CASCADE;

-- Create scraper_configs table with proper JSON validation
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
     jsonb_typeof(credentials->'username') = 'string' AND
     jsonb_typeof(credentials->'password') = 'string' AND
     (credentials->>'username') IS NOT NULL AND
     (credentials->>'username') != '' AND
     (credentials->>'password') IS NOT NULL AND
     (credentials->>'password') != ''
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

-- Create admin-only policies using direct role check
CREATE POLICY "admin_access"
ON scraper_configs
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
ON scraper_runs
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
ON scraper_logs
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Grant necessary permissions
GRANT ALL ON scraper_configs TO authenticated;
GRANT ALL ON scraper_runs TO authenticated;
GRANT ALL ON scraper_logs TO authenticated;

-- Add indexes
CREATE INDEX idx_scraper_runs_config ON scraper_runs(config_id);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX idx_scraper_logs_run ON scraper_logs(run_id);
CREATE INDEX idx_scraper_logs_level ON scraper_logs(level);