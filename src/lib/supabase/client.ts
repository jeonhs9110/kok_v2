/**
 * @deprecated Use `getSupabaseBrowser` from `@/lib/supabase/browser` instead.
 *
 * This shim keeps the existing call sites (`components/comments/*`,
 * `components/PostActions.tsx`, `components/pages/PostWritePage.tsx`)
 * compiling while we migrate them over. The exported `createClient` here
 * is exactly the new singleton helper renamed — same behavior, same
 * underlying memoized client.
 *
 * Migration is mechanical:
 *
 *   - import { createClient } from '@/lib/supabase/client';
 *   - const supabase = createClient();
 *   + import { getSupabaseBrowser } from '@/lib/supabase/browser';
 *   + const supabase = getSupabaseBrowser();
 *
 * Delete this file once no imports remain.
 */
export { getSupabaseBrowser as createClient } from './browser';
