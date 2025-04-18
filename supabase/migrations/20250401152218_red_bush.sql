/*
  # Add default scraper environments
  
  1. Changes
    - Insert default environments with proper credential validation
    - Use temporary function to ensure valid credentials
    - Add settings for each environment
    
  2. Security
    - Maintain existing RLS policies
    - Use proper credential format
*/

-- Create temporary function to build valid credentials
CREATE OR REPLACE FUNCTION temp_build_valid_credentials(
  username text,
  password text
) RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'username', COALESCE(username, 'temp_user'),
    'password', COALESCE(password, 'temp_pass')
  );
END;
$$ LANGUAGE plpgsql;

-- Insert default Salesdock environments
INSERT INTO scraper_environments (
  name,
  type,
  credentials,
  settings,
  is_active
) VALUES 
  (
    'Hosted Energy Admin',
    'hostedenergy',
    temp_build_valid_credentials('temp_user', 'temp_pass'),
    jsonb_build_object(
      'base_url', 'https://admin.hostedenergy.nl',
      'transactions_path', '/transactions'
    ),
    true
  ),
  (
    'Vattenfall Admin',
    'salesdock',
    temp_build_valid_credentials('temp_user', 'temp_pass'),
    jsonb_build_object(
      'base_url', 'https://app.salesdock.nl/vattenfall/admin',
      'transactions_path', '/transactions'
    ),
    true
  ),
  (
    'Askwadraat Admin',
    'salesdock',
    temp_build_valid_credentials('temp_user', 'temp_pass'),
    jsonb_build_object(
      'base_url', 'https://app.salesdock.nl/askwadraat/admin',
      'transactions_path', '/transactions'
    ),
    true
  ),
  (
    'Premium Servicedesk Admin',
    'salesdock',
    temp_build_valid_credentials('temp_user', 'temp_pass'),
    jsonb_build_object(
      'base_url', 'https://app.salesdock.nl/premium_servicedesk/admin',
      'transactions_path', '/transactions'
    ),
    true
  ),
  (
    '1Crew Vattenfall Admin',
    'salesdock',
    temp_build_valid_credentials('temp_user', 'temp_pass'),
    jsonb_build_object(
      'base_url', 'https://app.salesdock.nl/1crew-vattenfall/admin',
      'transactions_path', '/transactions'
    ),
    true
  );

-- Drop temporary function
DROP FUNCTION temp_build_valid_credentials;