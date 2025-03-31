/*
  # Add Vattenfall Propositions

  1. New Data
    - Adds propositions for Vattenfall Zakelijk project
    - Includes both 1-year and 3-year contracts
    - Sets up commission tiers for electricity and gas
    - Adds fixed fees for all propositions

  2. Changes
    - Creates propositions with required commission values
    - Adds commission tiers for different usage levels
    - Sets up fixed fees for both electricity and gas

  3. Security
    - No changes to security policies
*/

-- Create propositions
INSERT INTO propositions (id, project_id, name, commission, active)
VALUES 
  -- 1 year propositions
  (
    gen_random_uuid(),
    (SELECT id FROM projects WHERE name = 'Vattenfall Zakelijk' LIMIT 1),
    'Vattenfall Zakelijk Groen uit Nederland Vast 1 jaar',
    40.00,  -- Default commission rate
    true
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM projects WHERE name = 'Vattenfall Zakelijk' LIMIT 1),
    'Vattenfall VastePrijsGas opslag 1 1 jaar',
    40.00,  -- Default commission rate
    true
  ),
  -- 3 year propositions
  (
    gen_random_uuid(),
    (SELECT id FROM projects WHERE name = 'Vattenfall Zakelijk' LIMIT 1),
    'Vattenfall Zakelijk Groen uit Nederland Vast 3 jaar',
    75.00,  -- Higher commission for longer contract
    true
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM projects WHERE name = 'Vattenfall Zakelijk' LIMIT 1),
    'Vattenfall VastePrijsGas opslag 2 3 jaar',
    75.00,  -- Higher commission for longer contract
    true
  );

-- Add commission tiers for 1 year electricity
INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
SELECT 
  id as proposition_id,
  'electricity' as product_type,
  min_usage,
  max_usage,
  commission_amount
FROM propositions
CROSS JOIN (
  VALUES 
    (0, 3000, 40.00),
    (3001, 5000, 40.00),
    (5001, 10000, 40.00),
    (10001, 25000, 40.00),
    (25001, 50000, 40.00),
    (50001, 75000, 40.00),
    (75001, 100000, 40.00),
    (100001, NULL, 40.00)
) as tiers(min_usage, max_usage, commission_amount)
WHERE name = 'Vattenfall Zakelijk Groen uit Nederland Vast 1 jaar';

-- Add commission tiers for 1 year gas
INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
SELECT 
  id as proposition_id,
  'gas' as product_type,
  min_usage,
  max_usage,
  commission_amount
FROM propositions
CROSS JOIN (
  VALUES 
    (0, 1500, 40.00),
    (1501, 2500, 40.00),
    (2501, 5000, 40.00),
    (5001, 7500, 40.00),
    (7501, 10000, 40.00),
    (10001, 15000, 40.00),
    (15001, 25000, 40.00),
    (25001, NULL, 40.00)
) as tiers(min_usage, max_usage, commission_amount)
WHERE name = 'Vattenfall VastePrijsGas opslag 1 1 jaar';

-- Add commission tiers for 3 year electricity
INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
SELECT 
  id as proposition_id,
  'electricity' as product_type,
  min_usage,
  max_usage,
  commission_amount
FROM propositions
CROSS JOIN (
  VALUES 
    (0, 3000, 75.00),
    (3001, 5000, 75.00),
    (5001, 10000, 75.00),
    (10001, 25000, 75.00),
    (25001, 50000, 75.00),
    (50001, 75000, 75.00),
    (75001, 100000, 75.00),
    (100001, NULL, 75.00)
) as tiers(min_usage, max_usage, commission_amount)
WHERE name = 'Vattenfall Zakelijk Groen uit Nederland Vast 3 jaar';

-- Add commission tiers for 3 year gas
INSERT INTO proposition_tiers (proposition_id, product_type, min_usage, max_usage, commission_amount)
SELECT 
  id as proposition_id,
  'gas' as product_type,
  min_usage,
  max_usage,
  commission_amount
FROM propositions
CROSS JOIN (
  VALUES 
    (0, 1500, 75.00),
    (1501, 2500, 75.00),
    (2501, 5000, 75.00),
    (5001, 7500, 75.00),
    (7501, 10000, 75.00),
    (10001, 15000, 75.00),
    (15001, 25000, 75.00),
    (25001, NULL, 75.00)
) as tiers(min_usage, max_usage, commission_amount)
WHERE name = 'Vattenfall VastePrijsGas opslag 2 3 jaar';

-- Add fixed fees for all propositions
INSERT INTO proposition_fees (proposition_id, fee_type, product_type, amount)
SELECT 
  id as proposition_id,
  'fixed' as fee_type,
  product_type,
  5.00 as amount
FROM propositions
CROSS JOIN (
  VALUES 
    ('electricity'),
    ('gas')
) as products(product_type)
WHERE name IN (
  'Vattenfall Zakelijk Groen uit Nederland Vast 1 jaar',
  'Vattenfall VastePrijsGas opslag 1 1 jaar',
  'Vattenfall Zakelijk Groen uit Nederland Vast 3 jaar',
  'Vattenfall VastePrijsGas opslag 2 3 jaar'
);