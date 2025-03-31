/*
  # Add initial suppliers

  1. New Data
    - Add initial suppliers for the system
    - Each supplier has a name, description, and commission rate

  2. Security
    - No changes to security policies
*/

-- Insert initial suppliers
INSERT INTO suppliers (name, description, commission)
VALUES 
  ('Vattenfall', 'Leading energy supplier for both business and consumer markets', 75.00),
  ('Engie', 'Sustainable energy solutions for homes and businesses', 70.00),
  ('Greenchoice', 'Green energy provider focused on sustainability', 65.00),
  ('Essent', 'Comprehensive energy services for all markets', 72.50),
  ('Next Energy', 'Innovative energy solutions provider', 68.00);