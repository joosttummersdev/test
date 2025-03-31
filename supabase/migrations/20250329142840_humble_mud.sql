/*
  # Add Vattenfall projects and propositions

  1. New Data
    - Add Vattenfall business and consumer projects
    - Add initial propositions for each project
    - Projects include:
      - Vattenfall Zakelijk
      - Vattenfall Particulier

  2. Changes
    - Insert new projects
    - Insert corresponding propositions
*/

-- Get Vattenfall supplier ID
DO $$ 
DECLARE
  vattenfall_id uuid;
BEGIN
  SELECT id INTO vattenfall_id FROM suppliers WHERE name = 'Vattenfall';

  -- Insert Vattenfall Business Project
  WITH business_project AS (
    INSERT INTO projects (name, supplier_id, type, description)
    VALUES (
      'Vattenfall Zakelijk',
      vattenfall_id,
      'business',
      'Zakelijke energieoplossingen voor bedrijven van alle groottes'
    )
    RETURNING id
  )
  INSERT INTO propositions (project_id, name, commission, active)
  SELECT 
    business_project.id,
    proposition_name,
    commission_amount,
    true
  FROM business_project,
  (VALUES 
    ('Stroom + Gas vast', 80.00),
    ('Alleen stroom', 60.00),
    ('Variabel zakelijk', 70.00)
  ) AS props(proposition_name, commission_amount);

  -- Insert Vattenfall Consumer Project
  WITH consumer_project AS (
    INSERT INTO projects (name, supplier_id, type, description)
    VALUES (
      'Vattenfall Particulier',
      vattenfall_id,
      'consumer',
      'Energieoplossingen voor particuliere huishoudens'
    )
    RETURNING id
  )
  INSERT INTO propositions (project_id, name, commission, active)
  SELECT 
    consumer_project.id,
    proposition_name,
    commission_amount,
    true
  FROM consumer_project,
  (VALUES 
    ('3 jaar vast', 75.00),
    ('1 jaar vast', 65.00),
    ('Variabel', 55.00)
  ) AS props(proposition_name, commission_amount);
END $$;