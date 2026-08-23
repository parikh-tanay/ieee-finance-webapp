import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Runs on the server, reads the caller's session from cookies, and still
// respects RLS as that specific user — this is what makes Server Actions
// safe to call from the client without re-checking permissions by hand.
// NOTE: async because Next.js 15 made cookies() return a Promise — every
// caller of this function must use `await createClient()`.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: 60 * 60 * 12 },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component render — middleware refreshes the session instead
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );
}
