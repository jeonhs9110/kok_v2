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

/**
 * 2026-06-29 — Supabase-cutoff hardening: when env is missing, return
 * `null` instead of throwing so callers can decide whether to fall
 * through gracefully. Only /auth/callback (Supabase password-reset email
 * link landing pad) reaches getSupabaseServer() in the cutover state —
 * everything else routes through USE_COGNITO branches in
 * requireCustomer/requireAdmin. callback handles null below by
 * redirecting to /login with a link-expired error, which is exactly the
 * right UX for a stale Supabase email link landing after the cutoff.
 */
export const hasSupabaseEnv = !!(url && anonKey);

function assertPublicEnv(): { url: string; anonKey: string } | null {
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Request-scoped Supabase client wired to the visitor's session cookies.
 * Must be called inside a request context (Server Component, Route Handler,
 * Server Action) because it awaits Next.js's async `cookies()` API.
 *
 * Returns `null` (instead of throwing) when Supabase env is missing — see
 * the hasSupabaseEnv doc above. Callers must check.
 */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  const env = assertPublicEnv();
  if (!env) return null;
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
 *
 * Returns `null` instead of throwing when env is missing — same pattern
 * as getSupabaseServer above. Caller must check.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const env = assertPublicEnv();
  if (!env || !serviceKey) return null;
  return createServiceClient(env.url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
