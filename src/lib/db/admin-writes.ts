// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import { getPgPool } from './pool';
import type { CommentRow, PostRow, ProductRow } from './types';

// ─── generic helpers ─────────────────────────────────────────────
// Used by the per-resource admin routes once the route has validated
// the table name + filtered the payload against a fixed allow-list.
// NEVER pass arbitrary user input as `table` / `columns` — they go
// straight into SQL.

type PgParam = { placeholder: string; value: unknown };

function paramOf(value: unknown, index: number): PgParam {
  if (value === null || value === undefined) {
    return { placeholder: `$${index}`, value: null };
  }
  if (Array.isArray(value)) {
    // text[] columns — pg-node encodes JS arrays natively.
    return { placeholder: `$${index}`, value };
  }
  if (typeof value === 'object') {
    // jsonb columns — stringify + explicit cast so pg parses it back.
    return { placeholder: `$${index}::jsonb`, value: JSON.stringify(value) };
  }
  return { placeholder: `$${index}`, value };
}

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`[admin-writes] unsafe identifier: ${ident}`);
  }
  return `"${ident}"`;
}

/**
 * INSERT a row built from a key→value map. `defaults` get merged into
 * the payload at INSERT time (typically `{ is_active: true }`); they
 * are skipped on UPDATE.
 */
export async function genericInsertInPg(
  table: string,
  payload: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): Promise<Record<string, unknown> | null> {
  const merged = { ...defaults, ...payload };
  const keys = Object.keys(merged);
  if (keys.length === 0) throw new Error('[admin-writes] insert with no columns');
  const params = keys.map((k, i) => paramOf(merged[k], i + 1));
  const cols = keys.map(quoteIdent).join(', ');
  const placeholders = params.map(p => p.placeholder).join(', ');
  const values = params.map(p => p.value);
  const sql = `INSERT INTO public.${quoteIdent(table)} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const pool = getPgPool();
  const { rows } = await pool.query(sql, values);
  return (rows[0] as Record<string, unknown> | undefined) ?? null;
}

export async function genericUpdateInPg(
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const keys = Object.keys(payload);
  if (keys.length === 0) return true; // no-op
  const params = keys.map((k, i) => paramOf(payload[k], i + 2)); // $1 reserved for id
  const sets = keys.map((k, i) => `${quoteIdent(k)} = ${params[i].placeholder}`).join(', ');
  const values = [id, ...params.map(p => p.value)];
  const sql = `UPDATE public.${quoteIdent(table)} SET ${sets} WHERE id = $1`;
  const pool = getPgPool();
  const { rowCount } = await pool.query(sql, values);
  return (rowCount ?? 0) > 0;
}

export async function genericDeleteInPg(table: string, id: string): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `DELETE FROM public.${quoteIdent(table)} WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function genericSetActiveInPg(
  table: string,
  id: string,
  isActive: boolean,
): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `UPDATE public.${quoteIdent(table)} SET is_active = $2 WHERE id = $1`,
    [id, isActive],
  );
  return (rowCount ?? 0) > 0;
}

export async function genericListInPg(
  table: string,
  orderBy: string = 'created_at',
  direction: 'ASC' | 'DESC' = 'DESC',
): Promise<Record<string, unknown>[]> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT * FROM public.${quoteIdent(table)} ORDER BY ${quoteIdent(orderBy)} ${direction}`,
  );
  return rows as Record<string, unknown>[];
}

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

// ─── products ────────────────────────────────────────────────────
// Mirrors the column set the admin product form writes via Supabase
// today (see app/admin/products/_components/useProductForm.ts). When
// you add a new column to the products table, add it here AND in the
// admin API route's allow-list — silently dropping unknown columns
// from the payload is the safe default but means a forgotten column
// is invisible until a user notices their data didn't persist.
export interface AdminProductUpsertInput {
  name: string;
  summary: string | null;
  ingredient: string | null;
  description: string | null;
  detail_body: string | null;
  detail_components: unknown; // jsonb DetailComponent[]
  price: number;
  original_price: number | null;
  images: string[];
  naver_store_url: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  is_best_seller: boolean;
  show_cart_button: boolean;
  show_buy_button: boolean;
  seo: unknown | null; // jsonb ProductSeo
}

export async function listProductsForAdminInPg(): Promise<ProductRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<ProductRow>(
    `SELECT * FROM public.products ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createProductInPg(input: AdminProductUpsertInput): Promise<ProductRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<ProductRow>(
    `INSERT INTO public.products (
        name, summary, ingredient, description, detail_body,
        detail_components, price, original_price, images,
        naver_store_url, category_id, subcategory_id,
        is_best_seller, show_cart_button, show_buy_button, seo,
        is_active
     )
     VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16::jsonb,
        TRUE
     )
     RETURNING *`,
    [
      input.name,
      input.summary,
      input.ingredient,
      input.description,
      input.detail_body,
      JSON.stringify(input.detail_components ?? []),
      input.price,
      input.original_price,
      input.images,
      input.naver_store_url,
      input.category_id,
      input.subcategory_id,
      input.is_best_seller,
      input.show_cart_button,
      input.show_buy_button,
      input.seo === null ? null : JSON.stringify(input.seo),
    ],
  );
  return rows[0] ?? null;
}

export async function updateProductInPg(
  productId: string,
  input: AdminProductUpsertInput,
): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `UPDATE public.products
        SET name = $2,
            summary = $3,
            ingredient = $4,
            description = $5,
            detail_body = $6,
            detail_components = $7::jsonb,
            price = $8,
            original_price = $9,
            images = $10,
            naver_store_url = $11,
            category_id = $12,
            subcategory_id = $13,
            is_best_seller = $14,
            show_cart_button = $15,
            show_buy_button = $16,
            seo = $17::jsonb
      WHERE id = $1`,
    [
      productId,
      input.name,
      input.summary,
      input.ingredient,
      input.description,
      input.detail_body,
      JSON.stringify(input.detail_components ?? []),
      input.price,
      input.original_price,
      input.images,
      input.naver_store_url,
      input.category_id,
      input.subcategory_id,
      input.is_best_seller,
      input.show_cart_button,
      input.show_buy_button,
      input.seo === null ? null : JSON.stringify(input.seo),
    ],
  );
  return (rowCount ?? 0) > 0;
}

export async function setProductActiveInPg(productId: string, isActive: boolean): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `UPDATE public.products SET is_active = $2 WHERE id = $1`,
    [productId, isActive],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteProductInPg(productId: string): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `DELETE FROM public.products WHERE id = $1`,
    [productId],
  );
  return (rowCount ?? 0) > 0;
}

// ─── users (admin role + delete) ─────────────────────────────────
export async function setUserRoleInPg(userId: string, role: 'admin' | 'user'): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `UPDATE public.users SET role = $2 WHERE id = $1`,
    [userId, role],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Delete an admin-initiated user, cascading the rows that the original
 * Supabase `auth.users → ON DELETE CASCADE` FK used to clean up for
 * free. With the Cognito cutover those FKs are dead — customer_profiles
 * no longer has an active reference to delete-cascade from (`auth.users`
 * is gone from the RDS schema), and wishlist + the public.users row
 * itself were never FK-linked. So this function has to fan the delete
 * out manually.
 *
 * Surfaces cascaded (in order — wishlist + profile first so a row
 * never lingers PII-bearing if users-row delete fails halfway):
 *   - public.wishlist (user_id) — customer-curated product list
 *   - public.customer_profiles (id) — PII: name/phone/birthday/etc.
 *   - public.users (id) — the admin-facing identity row
 *
 * Pre-fix the admin /admin/users → Delete button only removed the
 * users row, leaving customer_profiles + wishlist orphaned. PIPA
 * §21 requires destruction of personal info on account deletion;
 * leaving customer_profiles behind is a real compliance gap. The
 * customer-initiated DELETE /api/customer/profile already cascades
 * this way — this just brings the admin path to parity.
 *
 * Returns true if the users row was deleted (the source-of-truth
 * for "did the account go away"); the upstream Cognito cleanup
 * decides whether the full account is gone.
 */
export async function deleteUserInPg(userId: string): Promise<boolean> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM public.wishlist WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM public.customer_profiles WHERE id = $1`, [userId]);
    const { rowCount } = await client.query(
      `DELETE FROM public.users WHERE id = $1`,
      [userId],
    );
    await client.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
    throw err;
  } finally {
    client.release();
  }
}

// ─── product_reviews (customer submit) ───────────────────────────
export async function insertProductReviewInPg(input: {
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  content: string;
}): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `INSERT INTO public.product_reviews
       (product_id, author_name, rating, title, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.product_id, input.author_name, input.rating, input.title, input.content],
  );
  return (rowCount ?? 0) > 0;
}

// ─── analytics (page view track) ─────────────────────────────────
export async function insertAnalyticsEventInPg(input: {
  country: string | null;
  path: string;
  referrer: string | null;
  ip_hash: string | null;
  traffic_source: string | null;
  search_keyword: string | null;
  device_type: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}): Promise<boolean> {
  const pool = getPgPool();
  const { rowCount } = await pool.query(
    `INSERT INTO public.analytics
       (country, path, referrer, ip_hash, traffic_source, search_keyword,
        device_type, utm_source, utm_medium, utm_campaign)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.country, input.path, input.referrer, input.ip_hash,
      input.traffic_source, input.search_keyword, input.device_type,
      input.utm_source, input.utm_medium, input.utm_campaign,
    ],
  );
  return (rowCount ?? 0) > 0;
}
