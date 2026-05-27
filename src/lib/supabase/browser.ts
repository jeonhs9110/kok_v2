import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase browser client. Use this in any `'use client'`
 * component or hook that needs to query / mutate Supabase from the browser.
 *
 *   import { getSupabaseBrowser } from '@/lib/supabase/browser';
 *   const supabase = getSupabaseBrowser();
 *
 * Module-level memoization keeps the client a process-wide singleton so
 * re-renders don't spawn extra realtime websocket connections or duplicate
 * auth listeners.
 *
 * Env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are
 * inlined at build time by Next.js. Missing values throw at first call —
 * we deliberately fail loud rather than silently returning a stub client
 * that would make every query return empty (this is the failure mode that
 * masked an outage on 2026-05-27).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  if (!url || !anonKey) {
    throw new Error(
      '[supabase/browser] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'is not set at build time. Verify GitHub Actions secrets / .env.local.'
    );
  }
  cached = createBrowserClient(url, anonKey);
  return cached;
}
