import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase server helpers for the App Router.
 *
 * Two entry points:
 *
 *   1. `getSupabaseServer()` — bound to the current request's cookies via
 *      Next.js's `cookies()` store. Respects the visitor's session, so RLS
 *      sees the authenticated user (or anon if signed out). Use this in
 *      Server Components, Route Handlers, and Server Actions.
 *
 *   2. `getSupabaseAdmin()` — service-role client. Bypasses RLS. Use only
 *      in trusted server contexts that legitimately need to act as the
 *      Supabase superuser (seeding, granting roles, cron). Never call from
 *      client code; never expose the service key under NEXT_PUBLIC_*.
 *
 * Env vars:
 *   - NEXT_PUBLIC_SUPABASE_URL          (both helpers)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY     (both helpers)
 *   - SUPABASE_SERVICE_ROLE_KEY         (admin only)
 *
 * Missing env values throw on first call. Failing loud beats silently
 * returning empty data — that exact failure mode misled us into thinking
 * the storefront was healthy when it was serving mock products.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertPublicEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      '[supabase/server] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'is not set. Configure these in your environment / GitHub Actions secrets.'
    );
  }
  return { url, anonKey };
}

/**
 * Request-scoped Supabase client wired to the visitor's session cookies.
 * Must be called inside a request context (Server Component, Route Handler,
 * Server Action) because it awaits Next.js's async `cookies()` API.
 */
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const env = assertPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        } catch {
          // Pure Server Component contexts make `cookies()` read-only.
          // Swallowing here is standard per Supabase's App Router guidance;
          // the middleware (src/proxy.ts) refreshes the session on the
          // next request, so the user never sees a stale token.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — use sparingly and only on the server.
 * Returns a non-cookie-bearing client; no user session is attached.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const env = assertPublicEnv();
  if (!serviceKey) {
    throw new Error(
      '[supabase/server] SUPABASE_SERVICE_ROLE_KEY is not set. This client ' +
        'bypasses RLS and must only be used in trusted server contexts. ' +
        'Never prefix this secret with NEXT_PUBLIC_.'
    );
  }
  return createServiceClient(env.url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
