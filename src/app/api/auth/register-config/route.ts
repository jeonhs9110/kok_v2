import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/auth/register-config
 *
 * Public read-only config for the storefront `/register` form:
 *   - the operator-configured field list, consent toggles, and
 *     terms/privacy URLs from `registration_config`
 *   - the list of enabled social providers (just `provider` +
 *     `is_enabled`, NEVER the client_secret) from `auth_providers_config`
 *
 * 2026-06-29: previously `RegisterForm.tsx` read both tables directly
 * via `getSupabaseBrowser().from(...)`. After the 2026-06-27 Supabase
 * decommission that became a frozen 2026-06-27 snapshot — operators
 * could enable a new social provider or change a required field in
 * /admin/registration (which writes to RDS via /api/admin/crud) and
 * the storefront register form kept showing the old config. New
 * customers were either prompted for fields that admins had removed
 * or weren't prompted for fields that admins had added.
 *
 * Anonymous endpoint (no auth check) — the register form has to load
 * before the customer signs in. Only safe columns are returned:
 *   - registration_config: fields / consent toggles / terms_url /
 *     privacy_url
 *   - auth_providers_config: provider + is_enabled
 *
 * NEVER returns secret_key / api_key / client_secret etc — those would
 * be a credential leak if served public.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface RegConfig {
  fields: unknown;
  require_marketing_consent: boolean | null;
  require_privacy_consent: boolean | null;
  terms_url: string | null;
  privacy_url: string | null;
}

interface AuthProvider {
  provider: string;
  is_enabled: boolean;
}

const DEFAULT_REG_CONFIG: RegConfig = {
  fields: [],
  require_marketing_consent: true,
  require_privacy_consent: true,
  terms_url: '/terms',
  privacy_url: '/privacy',
};

export async function GET() {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const [regRes, authRes] = await Promise.all([
        pool.query<RegConfig>(
          `SELECT fields, require_marketing_consent, require_privacy_consent,
                  terms_url, privacy_url
             FROM public.registration_config
             ORDER BY id ASC
             LIMIT 1`,
        ),
        pool.query<AuthProvider>(
          `SELECT provider, is_enabled
             FROM public.auth_providers_config
            WHERE is_enabled = true`,
        ),
      ]);
      return NextResponse.json({
        registration: regRes.rows[0] ?? DEFAULT_REG_CONFIG,
        providers: authRes.rows,
      });
    } catch (err) {
      console.error('[auth/register-config] pg read failed:', err);
      return NextResponse.json({
        registration: DEFAULT_REG_CONFIG,
        providers: [],
      });
    }
  }

  if (!supabase) {
    return NextResponse.json({
      registration: DEFAULT_REG_CONFIG,
      providers: [],
    });
  }
  const [regRes, authRes] = await Promise.all([
    supabase
      .from('registration_config')
      .select('fields, require_marketing_consent, require_privacy_consent, terms_url, privacy_url')
      .maybeSingle(),
    supabase
      .from('auth_providers_config')
      .select('provider, is_enabled')
      .eq('is_enabled', true),
  ]);
  return NextResponse.json({
    registration: (regRes.data as RegConfig | null) ?? DEFAULT_REG_CONFIG,
    providers: (authRes.data as AuthProvider[] | null) ?? [],
  });
}
