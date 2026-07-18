import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ververst de Supabase-sessie en beschermt de app: zonder geldige sessie ga je
 * naar /login. In demo-modus (geen env) wordt alles doorgelaten (geen login).
 * RLS blijft de echte beveiliging; dit is de routering.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Demo-modus: geen database, geen login.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Geen code tussen clientcreatie en getClaims(): dit verzorgt de token-refresh.
  const { data } = await supabase.auth.getClaims();
  const ingelogd = !!data?.claims;
  const pad = request.nextUrl.pathname;

  const redirect = (bestemming: string) => {
    const doel = request.nextUrl.clone();
    doel.pathname = bestemming;
    doel.search = "";
    const r = NextResponse.redirect(doel);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!ingelogd && pad !== "/login") return redirect("/login");
  if (ingelogd && pad === "/login") return redirect("/");

  return response;
}
