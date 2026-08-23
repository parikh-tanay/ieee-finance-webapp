import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// CRITICAL: this uses the SERVICE ROLE key, which bypasses RLS entirely.
// This file must only ever be imported from Server Actions / server-only
// code (files under app/**/actions.ts marked 'use server'). Never import
// this from a Client Component — the key would be bundled into browser JS.
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix specifically so
// Next.js refuses to expose it to the browser bundle.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
