-- 20260415120700_trg_check_assignment_completion.sql
-- Phase 0 Foundation — Task 9
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION check_assignment_completion_fn_direct(p_assignment_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Refresh denormalized counts from completion tables.
  UPDATE protocol_assignment pa
  SET
    procedures_completed = (
      SELECT COUNT(DISTINCT ps.step_id)
      FROM procedure_step ps
      JOIN procedure p ON ps.procedure_id = p.procedure_id
      JOIN procedure_step_completion psc ON psc.procedure_step_id = ps.step_id
        AND psc.protocol_assignment_id = pa.assignment_id
      WHERE p.protocol_id = pa.protocol_id
    ),
    tests_passed = (
      SELECT COUNT(DISTINCT kt.knowledge_test_id)
      FROM knowledge_test kt
      JOIN knowledge_test_attempt kta ON kta.knowledge_test_id = kt.knowledge_test_id
        AND kta.protocol_assignment_id = pa.assignment_id
        AND kta.passed = true
      WHERE kt.protocol_id = pa.protocol_id
    ),
    confirmations_signed = (
      SELECT COUNT(DISTINCT c.confirmation_id)
      FROM confirmation c
      JOIN confirmation_signature cs ON cs.confirmation_id = c.confirmation_id
        AND cs.protocol_assignment_id = pa.assignment_id
      WHERE c.protocol_id = pa.protocol_id
    )
  WHERE pa.assignment_id = p_assignment_id;

  -- Flip to completed when all counts satisfied AND observer (if needed) approved.
  UPDATE protocol_assignment pa
  SET status = 'completed', completed_at = now()
  WHERE pa.assignment_id = p_assignment_id
    AND pa.status IN ('not_started', 'in_progress', 'pending')
    AND pa.procedures_completed >= pa.procedures_total
    AND pa.tests_passed >= pa.tests_total
    AND pa.confirmations_signed >= pa.confirmations_total
    AND (
      (SELECT evidence_tier FROM protocol WHERE protocol_id = pa.protocol_id) = 'quiz'
      OR EXISTS (
        SELECT 1 FROM observer_request orq
        WHERE orq.protocol_assignment_id = pa.assignment_id
          AND orq.status = 'approved'
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_assignment_completion_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.protocol_assignment_id IS NOT NULL THEN
    PERFORM check_assignment_completion_fn_direct(NEW.protocol_assignment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_completion_on_observer_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM check_assignment_completion_fn_direct(NEW.protocol_assignment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_assignment_completion_step
  AFTER INSERT ON procedure_step_completion
  FOR EACH ROW EXECUTE FUNCTION check_assignment_completion_fn();

CREATE TRIGGER trg_check_assignment_completion_test
  AFTER INSERT ON knowledge_test_attempt
  FOR EACH ROW WHEN (NEW.passed = true)
  EXECUTE FUNCTION check_assignment_completion_fn();

CREATE TRIGGER trg_check_assignment_completion_confirm
  AFTER INSERT ON confirmation_signature
  FOR EACH ROW EXECUTE FUNCTION check_assignment_completion_fn();

CREATE TRIGGER trg_check_completion_on_observer_resolved
  AFTER UPDATE ON observer_request
  FOR EACH ROW EXECUTE FUNCTION check_completion_on_observer_fn();

COMMENT ON FUNCTION check_assignment_completion_fn IS
  'Auto-flips protocol_assignment.status to completed when all sub-completions present (including observer if tier requires).';
