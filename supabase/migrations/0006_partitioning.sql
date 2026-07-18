-- =============================================================================
-- 0006_partitioning.sql — OPTIONEEL: fact-tabel partitioneren per boekjaar
--
-- Draai dit NIET standaard. De niet-gepartitioneerde revenue_lines + BRIN-index
-- (0001) verwerkt tientallen miljoenen rijen prima. Zet dit pas in als:
--   * revenue_lines > ~10M rijen, OF
--   * de full-recompute-tijd (scripts/benchmark.ts) je target overschrijdt.
--
-- Aanpak: bouw een gepartitioneerde variant, kopieer de data, hernoem. Doe dit
-- in een onderhoudsvenster. Hieronder de DDL + een helper om jaar-partities te
-- maken. De PK/UNIQUE moet de partitiekey (boekjaar) bevatten.
-- =============================================================================

/*  Voorbeeld — gepartitioneerde opzet (vervangt de revenue_lines uit 0001):

CREATE TABLE revenue_lines_part (
  id               BIGINT GENERATED ALWAYS AS IDENTITY,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  periode          CHAR(7) NOT NULL,
  period_month     DATE GENERATED ALWAYS AS (make_date(substring(periode from 1 for 4)::int, substring(periode from 6 for 2)::int, 1)) STORED,
  boekjaar         INT  GENERATED ALWAYS AS (substring(periode from 1 for 4)::int) STORED,
  omzet            NUMERIC(14,2) NOT NULL,
  aantal           INTEGER NOT NULL,
  import_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, periode, boekjaar)      -- partitiekey in de PK
) PARTITION BY RANGE (boekjaar);

-- Maak een partitie voor één boekjaar aan.
CREATE OR REPLACE FUNCTION create_revenue_partition(p_year int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS revenue_lines_%s PARTITION OF revenue_lines_part FOR VALUES FROM (%s) TO (%s);',
    p_year, p_year, p_year + 1);
END $$;

-- SELECT create_revenue_partition(2024); ... enz.
-- INSERT INTO revenue_lines_part (product_id, periode, omzet, aantal, import_batch_id)
--   SELECT product_id, periode, omzet, aantal, import_batch_id FROM revenue_lines;
-- ALTER TABLE revenue_lines RENAME TO revenue_lines_old;
-- ALTER TABLE revenue_lines_part RENAME TO revenue_lines;
-- Herbouw de indexes uit 0001 op de nieuwe tabel; DROP revenue_lines_old na controle.
*/
