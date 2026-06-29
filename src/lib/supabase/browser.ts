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
 * inlined at build time by Next.js.
 *
 * 2026-06-29 — Supabase-cutoff hardening: previously this threw at first
 * call when env was missing. 17 admin pages + the register form call
 * `const supabase = getSupabaseBrowser()` AT MODULE LEVEL, which means
 * a throw runs at module load — every one of those pages would crash on
 * first visit if the operator clears NEXT_PUBLIC_SUPABASE_* before the
 * dispatchers route around it. Under USE_RDS_FROM_BROWSER + USE_COGNITO_FROM_BROWSER
 * (the prod cutover state), every actual `.from(...)` / `.auth.*` /
 * `.storage.*` call is already guarded behind those flags and never fires.
 * We just need the constructor itself to NOT throw at module load. The
 * placeholder URL keeps createBrowserClient happy; any accidental call
 * fails at the network layer, which the existing dispatcher-fallback
 * branches already treat as a no-op.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.invalid';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const hasRealEnv = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let cached: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  if (!hasRealEnv) {
    // Loud warning ONCE on first construction so the operator notices
    // they're running in cutoff mode. Silent is the failure mode that
    // masked an outage on 2026-05-27 — keep the noise, just stop
    // throwing.
    console.warn(
      '[supabase/browser] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'are not set. Returning a placeholder client — every actual Supabase call ' +
        'will fail at the network layer. Verify USE_RDS_FROM_BROWSER + USE_COGNITO_FROM_BROWSER ' +
        'route around it.'
    );
  }
  // Explicit PKCE flow. Pairs with /auth/callback (server-side code-for-session
  // exchange) so email links survive Gmail/Outlook prefetchers.
  cached = createBrowserClient(url, anonKey, {
    auth: { flowType: 'pkce' },
  });
  return cached;
}
