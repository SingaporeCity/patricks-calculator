"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("Inloggen mislukt. Controleer je e-mailadres en wachtwoord.");
      return;
    }
    // Harde navigatie zodat de proxy + server components de nieuwe sessie oppikken.
    window.location.assign("/");
  }

  const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">Patricks Calculator</div>
            <div className="text-xs text-muted">Royalty-berekening</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h1 className="mb-4 text-lg font-semibold">Inloggen</h1>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-muted">E-mailadres</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" required />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium text-muted">Wachtwoord</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="current-password" required />
          </label>
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
            {busy ? "Bezig…" : "Inloggen"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Nog geen account? Vraag de beheerder om je toe te voegen.
        </p>
      </div>
    </div>
  );
}
