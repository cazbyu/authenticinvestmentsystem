/*
  # Seed Wellness Domains
  
  1. Purpose
     - Insert default wellness domains that are shared across all users
     - These domains are system-wide and not user-specific
  
  2. Domains
     - Community: Building relationships and connections with others
     - Financial: Managing money, budgeting, and financial planning
     - Physical: Health, fitness, and physical well-being
     - Social: Social interactions and relationships
     - Emotional: Emotional health and self-awareness
     - Intellectual: Learning, mental stimulation, and growth
     - Recreational: Hobbies, leisure activities, and fun
     - Spiritual: Purpose, meaning, and spiritual practices
  
  3. Notes
     - Domains are created without a user_id (system-wide)
     - All authenticated users can read these domains
     - The sort_order determines display order in the UI
*/

-- Insert wellness domains (system-wide, no user_id)
INSERT INTO "0008-ap-domains" (name, description, sort_order)
VALUES
  ('Community', 'Building relationships and connections with others in your community', 1),
  ('Financial', 'Managing money, budgeting, investments, and financial planning', 2),
  ('Physical', 'Health, fitness, exercise, nutrition, and physical well-being', 3),
  ('Social', 'Social interactions, friendships, and interpersonal relationships', 4),
  ('Emotional', 'Emotional health, self-awareness, and emotional intelligence', 5),
  ('Intellectual', 'Learning, mental stimulation, creativity, and intellectual growth', 6),
  ('Recreational', 'Hobbies, leisure activities, entertainment, and fun', 7),
  ('Spiritual', 'Purpose, meaning, values, meditation, and spiritual practices', 8)
ON CONFLICT DO NOTHING;
