-- Adds 'protocol' value to the journey_test_type enum.
-- Used by the Protocol Verification Engine runner to distinguish
-- protocol-driven test runs from automated (Playwright) and manual runs.

ALTER TYPE journey_test_type ADD VALUE IF NOT EXISTS 'protocol';

COMMENT ON TYPE journey_test_type IS 'automated = Playwright E2E, manual = human QA, protocol = Protocol Verification Engine';
