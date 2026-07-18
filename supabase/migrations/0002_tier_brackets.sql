-- =============================================================================
-- 0002_tier_brackets.sql — Staffel-schijven per contract
--
-- Marginale staffel op cumulatief AANTAL exemplaren. Een vast contract heeft
-- geen rijen hier; de reken-engine synthetiseert dan één schijf [0, oneindig)
-- tegen contracts.flat_rate_pct.
-- =============================================================================

CREATE TABLE tier_brackets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  lower_units  BIGINT NOT NULL,          -- inclusief; eerste schijf = 0
  upper_units  BIGINT,                   -- NULL = oneindig (bovenste schijf)
  rate_pct     NUMERIC(5,2) NOT NULL,
  UNIQUE (contract_id, lower_units),
  CHECK (upper_units IS NULL OR upper_units > lower_units)
);
CREATE INDEX idx_tier_brackets_contract ON tier_brackets (contract_id);

ALTER TABLE tier_brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tier_brackets_read_auth  ON tier_brackets FOR SELECT USING (is_staff());
CREATE POLICY tier_brackets_write_admin ON tier_brackets FOR ALL USING (is_admin()) WITH CHECK (is_admin());
