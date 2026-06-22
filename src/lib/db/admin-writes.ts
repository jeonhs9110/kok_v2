// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import { getPgPool } from './pool';
import type { CommentRow, PostRow } from './types';

/**
 * Phase C2 — pg-backed write helpers for server-callable Supabase
 * mutations.
 *
 * Scope of this file is narrow on purpose: only writes that already
 * have a server-side wrapper in `@/lib/api/*` and can therefore be
 * dispatched via the same `if (process.env.USE_RDS === 'true')` switch
 * we used for reads in C1c.
 *
 * The much larger pool of admin writes lives in `app/admin/<page>/_components/use*.ts`
 * client hooks that hit `getSupabaseBrowser()` directly. Those cannot
 * be flipped to RDS via an env switch — they need a server-side API
 * route to call into. That conversion lands alongside Phase D
 * (Cognito JWT middleware), so the route handlers can authenticate
 * the caller before reaching the pg pool.
 */

// ─── comments ────────────────────────────────────────────────────
export interface CreateCommentInput {
  post_id: string;
  parent_id?: string | null;
  author_name: string;
  content: string;
  is_admin_comment: boolean;
}

export async function createCommentInPg(input: CreateCommentInput): Promise<CommentRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<CommentRow>(
    `INSERT INTO public.comments
       (post_id, parent_id, author_name, content, is_admin_comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, post_id, parent_id, author_name, content, is_admin_comment, created_at`,
    [
      input.post_id,
      input.parent_id ?? null,
      input.author_name,
      input.content,
      input.is_admin_comment,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteCommentInPg(commentId: string): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `DELETE FROM public.comments WHERE id = $1`,
    [commentId],
  );
  return (rowCount ?? 0) > 0;
}

// ─── posts ───────────────────────────────────────────────────────
export interface UpdatePostInput {
  title: string;
  content: string;
}

export async function updatePostInPg(postId: string, input: UpdatePostInput): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query<PostRow>(
    `UPDATE public.posts
        SET title = $2,
            content = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [postId, input.title, input.content],
  );
  return (rowCount ?? 0) > 0;
}

export async function deletePostInPg(postId: string): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `DELETE FROM public.posts WHERE id = $1`,
    [postId],
  );
  return (rowCount ?? 0) > 0;
}

// ─── site_settings ───────────────────────────────────────────────
// JSONB value column — callers store strings, numbers, and structured
// payloads (top_stripe / best_seller_display / homepage_section_order).
// We always cast to ::jsonb so a raw string ends up as a JSON string
// rather than a SQL text literal, matching Supabase's PostgREST shape.
export async function setSiteSettingInPg(key: string, value: unknown): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `INSERT INTO public.site_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
  return (rowCount ?? 0) > 0;
}

export async function setSiteSettingsInPg(entries: Record<string, unknown>): Promise<boolean> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return true;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const key of keys) {
      await client.query(
        `INSERT INTO public.site_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = NOW()`,
        [key, JSON.stringify(entries[key])],
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin-writes] setSiteSettingsInPg failed:', err);
    return false;
  } finally {
    client.release();
  }
}
