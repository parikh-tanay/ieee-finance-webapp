import { createBrowserClient } from '@supabase/ssr';

// Uses only the public anon key. Every request from this client is still
// gated by the RLS policies in supabase/schema.sql — the anon key alone
// grants nothing without a valid, role-checked session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
