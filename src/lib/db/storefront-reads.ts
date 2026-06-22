// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import { getPgPool } from './pool';
import type {
  CarouselSlideRow, ReviewCardRow, SiteSettingRow, SiteBackgroundRow,
  HomepageBannerRow, ShortsRow, ShortsConfigRow, InstagramConfigRow,
  InstagramPostRow, PromoBannerRow, SubHeroBannerRow, CategoryRow,
  CommentRow, PostRow,
} from './types';

/**
 * Phase C1b — every storefront-facing read function that previously hit
 * Supabase has a pg-backed twin here. Each one mirrors its Supabase
 * counterpart field-for-field; the dispatcher in `@/lib/api/*` and
 * `@/lib/cache/*` picks the pg path when USE_RDS=true.
 *
 * One file keeps the migration churn reviewable in a single sitting.
 * After Phase F cutover, the Supabase branches are deleted and these
 * functions can be split back into per-domain modules without
 * affecting behavior.
 */

// ─── carousel ─────────────────────────────────────────────────────
export async function getActiveSlidesFromPg(): Promise<CarouselSlideRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<CarouselSlideRow>(
    `SELECT * FROM public.carousel_slides
      WHERE is_active = true
      ORDER BY sort_order ASC`,
  );
  return rows;
}

export async function getAllSlidesFromPg(): Promise<CarouselSlideRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<CarouselSlideRow>(
    `SELECT * FROM public.carousel_slides
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows;
}

// ─── reviews (review_cards) ───────────────────────────────────────
export async function getActiveReviewCardsFromPg(): Promise<ReviewCardRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<ReviewCardRow>(
    `SELECT id, image_url, title, content_html, link_url, sort_order, is_active
       FROM public.review_cards
      WHERE is_active = true
      ORDER BY sort_order ASC`,
  );
  return rows;
}

export async function getReviewCardFromPg(id: string): Promise<ReviewCardRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<ReviewCardRow>(
    `SELECT id, image_url, title, content_html, link_url, sort_order, is_active
       FROM public.review_cards
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getAllReviewCardsFromPg(): Promise<ReviewCardRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<ReviewCardRow>(
    `SELECT id, image_url, title, content_html, link_url, sort_order, is_active
       FROM public.review_cards
      ORDER BY sort_order ASC`,
  );
  return rows;
}

// ─── site_settings (key-value) ────────────────────────────────────
// Used by getSiteSetting / getSiteSettings AND by the JSONB readers
// for top_stripe / best_seller_display / section_order / theme_tokens
// which all live as rows in this table.
export async function getSiteSettingFromPg(key: string): Promise<unknown> {
  const pool = getPgPool();
  const { rows } = await pool.query<SiteSettingRow>(
    `SELECT value FROM public.site_settings WHERE key = $1 LIMIT 1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getSiteSettingsFromPg(keys: string[]): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};
  const pool = getPgPool();
  const { rows } = await pool.query<SiteSettingRow>(
    `SELECT key, value FROM public.site_settings WHERE key = ANY($1)`,
    [keys],
  );
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = null;
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ─── site_backgrounds ─────────────────────────────────────────────
export async function getActiveSiteBackgroundFromPg(): Promise<SiteBackgroundRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<SiteBackgroundRow>(
    `SELECT id, file_url, file_type, scroll_driven, is_active, sort_order, created_at
       FROM public.site_backgrounds
      WHERE is_active = true
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ─── homepage_banners ─────────────────────────────────────────────
export async function getHomepageBannersFromPg(): Promise<HomepageBannerRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<HomepageBannerRow>(
    `SELECT id, text, link_url, bg_color, text_color, is_active
       FROM public.homepage_banners
      WHERE is_active = true`,
  );
  return rows;
}

// ─── shorts ───────────────────────────────────────────────────────
export async function getShortsFromPg(): Promise<ShortsRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<ShortsRow>(
    `SELECT id, youtube_id, product_id, created_at
       FROM public.shorts
      ORDER BY created_at DESC
      LIMIT 10`,
  );
  return rows;
}

export async function getShortsConfigFromPg(): Promise<ShortsConfigRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<ShortsConfigRow>(
    `SELECT id, bg_type, bg_color, bg_media_url, bg_media_type,
            header_text, header_font_size, header_text_color, header_bg_color
       FROM public.shorts_config
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ─── instagram ────────────────────────────────────────────────────
export async function getInstagramConfigFromPg(): Promise<InstagramConfigRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<InstagramConfigRow>(
    `SELECT id, handle, description, bg_type, bg_color, bg_media_url,
            bg_media_type, header_font_size, header_text_color, header_bg_color
       FROM public.instagram_config
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function getInstagramPostsFromPg(): Promise<InstagramPostRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<InstagramPostRow>(
    `SELECT id, image_url, link_url, post_url, sort_order, is_active
       FROM public.instagram_posts
      WHERE is_active = true
      ORDER BY sort_order ASC
      LIMIT 6`,
  );
  return rows;
}

// ─── promo banners ────────────────────────────────────────────────
export async function getPromoBannersFromPg(): Promise<PromoBannerRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<PromoBannerRow>(
    `SELECT id, image_url, link_url, sort_order, is_active
       FROM public.promo_banners
      WHERE is_active = true
      ORDER BY sort_order ASC
      LIMIT 2`,
  );
  return rows;
}

// ─── sub-hero ─────────────────────────────────────────────────────
export async function getActiveSubHeroFromPg(): Promise<SubHeroBannerRow | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<SubHeroBannerRow>(
    `SELECT * FROM public.sub_hero_banners
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ─── categories ───────────────────────────────────────────────────
export async function getCategoriesTreeFromPg(): Promise<CategoryRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<CategoryRow>(
    `SELECT * FROM public.categories
      WHERE is_active = true
      ORDER BY sort_order ASC`,
  );
  return rows;
}

export async function getAllCategoriesFromPg(): Promise<CategoryRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<CategoryRow>(
    `SELECT * FROM public.categories
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows;
}

// ─── menus extras (posts/comments) ────────────────────────────────
export async function getPostsByMenuFromPg(menuId: string): Promise<PostRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<PostRow>(
    `SELECT * FROM public.posts
      WHERE menu_id = $1 AND is_published = true
      ORDER BY is_admin_post DESC, created_at DESC`,
    [menuId],
  );
  return rows;
}

export async function getPostsByMenuPaginatedFromPg(
  menuId: string,
  page: number,
  pageSize: number,
): Promise<{ posts: PostRow[]; total: number }> {
  const pool = getPgPool();
  const offset = (page - 1) * pageSize;
  const [{ rows: postsRows }, { rows: countRows }] = await Promise.all([
    pool.query<PostRow>(
      `SELECT * FROM public.posts
        WHERE menu_id = $1 AND is_published = true
        ORDER BY is_admin_post DESC, created_at DESC
        LIMIT $2 OFFSET $3`,
      [menuId, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.posts
        WHERE menu_id = $1 AND is_published = true`,
      [menuId],
    ),
  ]);
  return { posts: postsRows, total: Number(countRows[0]?.count ?? 0) };
}

export async function getCommentsByPostFromPg(postId: string): Promise<CommentRow[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<CommentRow>(
    `SELECT * FROM public.comments
      WHERE post_id = $1
      ORDER BY created_at ASC`,
    [postId],
  );
  return rows;
}
