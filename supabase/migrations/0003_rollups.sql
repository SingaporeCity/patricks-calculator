-- =============================================================================
-- 0003_rollups.sql — Gematerialiseerde reken-uitkomsten (de UI leest ALLEEN deze)
--
-- Deze tabellen worden bij import/on-demand herrekend door recompute() (0004).
-- Reads worden zo O(1): geen zware aggregatie op request-tijd.
-- =============================================================================

CREATE TABLE accrual_monthly (
  contract_id    UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  periode        CHAR(7) NOT NULL,
  boekjaar       INT NOT NULL,
  omzet          NUMERIC(14,2) NOT NULL,
  aantal         BIGINT NOT NULL,
  royalty_cost   NUMERIC(16,4) NOT NULL,     -- onafgerond (afronden pas bij payout)
  effective_rate NUMERIC(9,6) NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, periode)
);
CREATE INDEX idx_accrual_monthly_year ON accrual_monthly (contract_id, boekjaar);

CREATE TABLE advance_ledger (
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES authors(id)   ON DELETE CASCADE,
  boekjaar        INT NOT NULL,
  advance_added   NUMERIC(14,2) NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL,    -- te verrekenen voorschot dit jaar (carry + nieuw)
  earned          NUMERIC(16,4) NOT NULL,
  recouped        NUMERIC(14,2) NOT NULL,
  closing_balance NUMERIC(14,2) NOT NULL,    -- schuift door naar volgend jaar
  payout          NUMERIC(14,2) NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, author_id, boekjaar)
);
CREATE INDEX idx_advance_ledger_author ON advance_ledger (author_id, boekjaar);

CREATE TABLE payout_annual (
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES authors(id)   ON DELETE CASCADE,
  boekjaar        INT NOT NULL,
  contract_earned NUMERIC(16,4) NOT NULL,
  share           NUMERIC(7,4) NOT NULL,
  earned_author   NUMERIC(16,4) NOT NULL,
  payout          NUMERIC(14,2) NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, author_id, boekjaar)
);
CREATE INDEX idx_payout_annual_author ON payout_annual (author_id, boekjaar);
CREATE INDEX idx_payout_annual_year   ON payout_annual (boekjaar);

-- Status van (achtergrond-)herberekeningen, voor de progress-UI.
CREATE TABLE recompute_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope         TEXT NOT NULL CHECK (scope IN ('all','contracts')),
  contract_ids  UUID[],
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','error')),
  rows_written  INT,
  ms            NUMERIC,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

ALTER TABLE accrual_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_annual   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompute_runs  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accrual_monthly','advance_ledger','payout_annual','recompute_runs']
  LOOP
    EXECUTE format('CREATE POLICY %I_read_auth ON %I FOR SELECT USING (is_staff());', t, t);
    EXECUTE format('CREATE POLICY %I_write_admin ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin());', t, t);
  END LOOP;
END $$;
