-- Add three-level linkage to deviation table
-- source_task_id: D6 session_task where deviation was detected
-- procedure_id: K procedure that was violated
-- protocol_id: D3 compliance domain affected

ALTER TABLE deviation ADD COLUMN source_task_id UUID REFERENCES session_task(id);
ALTER TABLE deviation ADD COLUMN procedure_id UUID REFERENCES procedure(procedure_id);
ALTER TABLE deviation ADD COLUMN protocol_id UUID REFERENCES protocol(protocol_id);

CREATE INDEX idx_deviation_source_task ON deviation(source_task_id) WHERE source_task_id IS NOT NULL;
CREATE INDEX idx_deviation_procedure ON deviation(procedure_id) WHERE procedure_id IS NOT NULL;

COMMENT ON COLUMN deviation.source_task_id IS 'D6: session_task where deviation was detected';
COMMENT ON COLUMN deviation.procedure_id IS 'K: which standard was violated';
COMMENT ON COLUMN deviation.protocol_id IS 'D3: which compliance domain it affects';
