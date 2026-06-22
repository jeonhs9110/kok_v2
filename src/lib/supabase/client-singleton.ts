import { createClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase client singleton.
 *
 * Pre-extraction this lived at the top of `src/lib/api/products.ts`,
 * which also hosts `getProducts()` — and `getProducts()` dispatches
 * to `@/lib/db/products` (a `'server-only'` module that imports `pg`)
 * when `USE_RDS=true`. That made the whole `api/products` module
 * un-importable from Client Components: webpack's static trace of
 * the dynamic import in `getProducts()` resolved `pg/lib/stream.js`
 * for the browser bundle and failed on `require('tls')`.
 *
 * Hoisting the singleton up one directory lets Client Components
 * (Header.tsx, ProductReviewSection.tsx) reach the Supabase client
 * without dragging the dispatcher's import graph into the browser
 * bundle.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
