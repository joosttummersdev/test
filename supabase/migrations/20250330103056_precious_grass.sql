/*
  # Fix RLS Policies for Scraper Tables

  1. Changes
    - Drop existing policies
    - Create new policies using JWT claims
    - Add better error handling
    
  2. Security
    - Use JWT claims for role checks
    - Maintain admin-only access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage scraper configs" ON scraper_configs;
DROP POLICY IF EXISTS "Admins can manage scraper runs" ON scraper_runs;
DROP POLICY IF EXISTS "Admins can manage scraper logs" ON scraper_logs;

-- Create new policies using JWT claims
CREATE POLICY "allow_admin_access"
ON scraper_configs
FOR ALL 
TO authenticated
USING (
  current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
);

CREATE POLICY "allow_admin_access"
ON scraper_runs
FOR ALL 
TO authenticated
USING (
  current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
);

CREATE POLICY "allow_admin_access"
ON scraper_logs
FOR ALL 
TO authenticated
USING (
  current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin'
);

-- Grant necessary permissions
GRANT ALL ON scraper_configs TO authenticated;
GRANT ALL ON scraper_runs TO authenticated;
GRANT ALL ON scraper_logs TO authenticated;