/*
  # Test Data for Global Cycles

  ## Summary
  Creates test global cycles for development and testing of the timeline activation system.
  This migration should only be run in development/testing environments.

  ## Important Note
  Comment out or remove this migration in production environments.
*/

-- Insert test global cycles (only if they don't exist)
INSERT INTO "0008-ap-global-cycles" (
  id,
  title,
  cycle_label,
  start_date,
  end_date,
  reflection_end,
  is_active,
  status
)
VALUES
  (
    'c1111111-1111-1111-1111-111111111111'::uuid,
    'Q1 2025 Growth Cycle',
    'Q1-2025',
    '2025-01-06',
    '2025-03-30',
    '2025-04-06',
    true,
    'active'
  ),
  (
    'c2222222-2222-2222-2222-222222222222'::uuid,
    'Q2 2025 Innovation Cycle',
    'Q2-2025',
    '2025-04-07',
    '2025-06-29',
    '2025-07-06',
    true,
    'active'
  ),
  (
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'Fall 2025 12 Week Timeline',
    'Fall-2025',
    '2025-09-28',
    '2025-12-20',
    '2025-12-27',
    true,
    'active'
  ),
  (
    'c4444444-4444-4444-4444-444444444444'::uuid,
    'Q4 2025 Excellence Cycle',
    'Q4-2025',
    '2025-10-06',
    '2025-12-28',
    '2026-01-04',
    true,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- Add comment to remind users this is test data
COMMENT ON TABLE "0008-ap-global-cycles" IS 'Test data created by migration 20251003000001_global_cycles_test_data.sql';
