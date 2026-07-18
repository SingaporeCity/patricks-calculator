import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin-client met de secret key: passeert RLS en draait de recompute-/import-
 * RPC's. Door `server-only` faalt de build als dit per ongeluk in clientcode
 * belandt.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SECRET_KEY ontbreekt in .env.local — nodig voor recompute/import (zie .env.example).");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
