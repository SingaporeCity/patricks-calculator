import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  // cookies() eerst: markeert de route als dynamisch zodat er bij `next build`
  // niet zonder omgevingsvariabelen wordt geprerenderd.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase-omgevingsvariabelen ontbreken. Kopieer .env.example naar .env.local en vul de waarden in.",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components mogen geen cookies schrijven; de proxy ververst de sessie.
        }
      },
    },
  });
}
