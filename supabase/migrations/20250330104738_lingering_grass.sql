/*
  # Fix credentials column type in scraper_configs table
  
  1. Changes
    - Verify credentials column type is jsonb
    - Add proper validation constraints
    - Preserve existing data
    
  2. Impact
    - No data loss
    - Ensures proper JSON storage and validation
*/

-- First verify if table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'scraper_configs'
  ) THEN
    -- Create table if it doesn't exist
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
  ELSE
    -- Verify column type and modify if needed
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'scraper_configs'
      AND column_name = 'credentials'
      AND data_type != 'jsonb'
    ) THEN
      -- Backup existing data
      CREATE TEMP TABLE scraper_configs_backup AS 
      SELECT * FROM scraper_configs;

      -- Alter column type
      ALTER TABLE scraper_configs 
      ALTER COLUMN credentials TYPE jsonb 
      USING credentials::jsonb;

      -- Add constraints
      ALTER TABLE scraper_configs
      ADD CONSTRAINT valid_credentials 
      CHECK (
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
      );
    END IF;
  END IF;
END $$;

-- Verify RLS is enabled
ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;

-- Verify admin policy exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'scraper_configs' 
    AND policyname = 'admin_access'
  ) THEN
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
  END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON scraper_configs TO authenticated;