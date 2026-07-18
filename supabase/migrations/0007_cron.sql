-- =============================================================================
-- 0007_cron.sql — OPTIONEEL: achtergrond-worker voor grote herberekeningen
--
-- Voor recomputes die langer duren dan een serverless-timeout: de Server Action
-- zet een recompute_runs-rij op 'queued' en keert direct terug; pg_cron pakt 'm
-- op. De UI pollt recompute_runs voor de voortgang.
--
-- Vereist de pg_cron-extensie (Supabase: Dashboard -> Database -> Extensions).
-- =============================================================================

CREATE OR REPLACE FUNCTION run_queued_recomputes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r recompute_runs%ROWTYPE;
  v RECORD;
BEGIN
  -- Neem één wachtende taak; SKIP LOCKED voorkomt dubbel oppakken.
  SELECT * INTO r FROM recompute_runs
  WHERE status = 'queued'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE recompute_runs SET status = 'running', started_at = now() WHERE id = r.id;

  BEGIN
    SELECT * INTO v FROM recompute(r.contract_ids);
    UPDATE recompute_runs
      SET status = 'done', rows_written = v.rows_written, ms = v.ms, finished_at = now()
      WHERE id = r.id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE recompute_runs SET status = 'error', error = SQLERRM, finished_at = now() WHERE id = r.id;
  END;
END $$;

GRANT EXECUTE ON FUNCTION run_queued_recomputes() TO service_role;

-- Plan de worker (elke minuut). Ontkommentarieer na het inschakelen van pg_cron:
-- SELECT cron.schedule('patricks-recompute-worker', '* * * * *', $$ SELECT run_queued_recomputes(); $$);
