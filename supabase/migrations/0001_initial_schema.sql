-- =============================================================================
-- 0001_initial_schema.sql — Patricks Calculator basisschema
--
-- Domein (producten, auteurs, contracten + koppels), de omzet-fact-tabel en de
-- import-staging. Draai als eerste in een schoon Supabase-project via de SQL-
-- editor. Engelse identifiers, Nederlandse comments. Geld NUMERIC(14,2),
-- percentages NUMERIC(5,2).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER: updated_at bijwerken
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

-- ============================================
-- HELPERS: rollen (intern, single-org)
-- ============================================
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.role() = 'authenticated';
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

-- ============================================
-- TABELLEN
-- ============================================

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,          -- business-key uit de import (bv. ISBN)
  title       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE authors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contracts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number  TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  flat_rate_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,        -- basis-royalty% / enige schijf bij vast contract
  royalty_model    TEXT NOT NULL DEFAULT 'flat' CHECK (royalty_model IN ('flat','tiered')),
  tier_accumulator TEXT NOT NULL DEFAULT 'contract' CHECK (tier_accumulator IN ('contract','product')),
  tier_reset       TEXT NOT NULL DEFAULT 'year' CHECK (tier_reset IN ('year','lifetime')),
  start_date       DATE,
  end_date         DATE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Koppel product <-> contract (many-to-many). Wil je een product aan precies
-- één contract binden, vervang de PK-comment door een UNIQUE (product_id).
CREATE TABLE contract_products (
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  PRIMARY KEY (contract_id, product_id)
);
CREATE INDEX idx_contract_products_product ON contract_products (product_id);

-- Koppel auteur <-> contract: aandeel (%) + voorschot per auteur.
CREATE TABLE contract_authors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id   UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES authors(id)   ON DELETE CASCADE,
  share         NUMERIC(7,4) NOT NULL DEFAULT 0,        -- aandeel in procenten (0..100, incl. 100)
  advance       NUMERIC(14,2) NOT NULL DEFAULT 0,       -- voorschot
  advance_year  INT,                                    -- boekjaar waarin het voorschot opent
  UNIQUE (contract_id, author_id)
);
CREATE INDEX idx_contract_authors_author ON contract_authors (author_id);

-- Import-audit: elke upload is een batch.
CREATE TABLE import_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename      TEXT,
  uploaded_by   UUID,
  status        TEXT NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded','validating','staged','applying','applied','failed')),
  period_from   TEXT,
  period_to     TEXT,
  total_rows    INT NOT NULL DEFAULT 0,
  valid_rows    INT NOT NULL DEFAULT 0,
  error_rows    INT NOT NULL DEFAULT 0,
  applied_rows  INT NOT NULL DEFAULT 0,
  error_summary JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at    TIMESTAMPTZ
);

-- Omzet-fact-tabel. Compacte BIGINT-PK; generated kolommen voor snelle filters.
CREATE TABLE revenue_lines (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  periode          CHAR(7) NOT NULL,                    -- 'YYYY-MM'
  -- make_date is IMMUTABLE (vereist voor generated columns); to_date/::date niet.
  period_month     DATE GENERATED ALWAYS AS (make_date(substring(periode from 1 for 4)::int, substring(periode from 6 for 2)::int, 1)) STORED,
  boekjaar         INT  GENERATED ALWAYS AS (substring(periode from 1 for 4)::int) STORED,
  omzet            NUMERIC(14,2) NOT NULL,
  aantal           INTEGER NOT NULL,
  import_batch_id  UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, periode)
);
CREATE INDEX idx_revenue_lines_product_periode ON revenue_lines (product_id, periode);
CREATE INDEX idx_revenue_lines_period_month_brin ON revenue_lines USING BRIN (period_month);
CREATE INDEX idx_revenue_lines_batch ON revenue_lines (import_batch_id);

-- Import-staging (per rij, met validatie-resultaat).
CREATE TABLE revenue_staging (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id      UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_no        INT NOT NULL,
  product_code  TEXT,
  periode       TEXT,
  omzet         NUMERIC(14,2),
  aantal        INTEGER,
  is_valid      BOOLEAN NOT NULL DEFAULT false,
  error         TEXT
);
CREATE INDEX idx_revenue_staging_batch ON revenue_staging (batch_id);

-- updated_at triggers
CREATE TRIGGER trg_products_updated   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_authors_updated    BEFORE UPDATE ON authors    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contracts_updated  BEFORE UPDATE ON contracts  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (intern: authenticated mag lezen, admin mag schrijven)
-- ============================================
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_authors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_staging   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','authors','contracts','contract_products',
                           'contract_authors','import_batches','revenue_lines','revenue_staging']
  LOOP
    EXECUTE format('CREATE POLICY %I_read_auth ON %I FOR SELECT USING (is_staff());', t, t);
    EXECUTE format('CREATE POLICY %I_write_admin ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin());', t, t);
  END LOOP;
END $$;
