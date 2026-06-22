/**
 * Phase C2b — flag the admin browser code checks to decide whether to
 * route writes through `/api/admin/...` (RDS-backed) or to keep using
 * `getSupabaseBrowser()` direct upserts.
 *
 * Server-side dispatchers read `process.env.USE_RDS` (no NEXT_PUBLIC_
 * prefix — kept off the client bundle for the read paths). For client
 * dispatch the value has to be inlined into the browser at build time,
 * so we mirror it as `NEXT_PUBLIC_USE_RDS`.
 *
 * Both env vars MUST be flipped together at Phase F cutover — otherwise
 * the admin browser would route writes to the API (which uses pg) while
 * the storefront still reads from Supabase, or vice-versa.
 */
export const USE_RDS_FROM_BROWSER = process.env.NEXT_PUBLIC_USE_RDS === 'true';
