import 'server-only';

/**
 * Hand-rolled DB row types matching `supabase/migrations/`.
 *
 * The auto-generated types from `supabase gen types` are JSON-shaped
 * and don't survive the RDS migration cleanly (they include
 * Supabase-specific helpers + auth schema refs). Maintaining these
 * by hand is small enough to be tractable — most tables have <10
 * columns and rarely change after the initial migration.
 *
 * Naming convention: PascalCase interfaces match the table name
 * (e.g., `ProductRow` for `public.products`). The `*Row` suffix
 * marks "fresh from DB row, snake_case columns" — separate from the
 * camelCased domain types in `@/lib/api/*` which are app-facing.
 */

export interface ProductRow {
  id: string;
  name: string;
  summary: string | null;
  ingredient: string | null;
  description: string | null;
  detail_body: string | null;
  detail_components: unknown | null; // jsonb DetailComponent[]
  price: number;
  original_price: number | null;
  images: string[] | null; // text[]
  is_active: boolean;
  is_best_seller: boolean | null;
  naver_store_url: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  show_cart_button: boolean | null;
  show_buy_button: boolean | null;
  seo: unknown | null; // jsonb ProductSeo
  created_at: string;
}

export interface CategoryRow {
  id: string;
  name_kr: string;
  name_en: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface MenuRow {
  id: string;
  parent_id: string | null;
  slug: string;
  title: Record<string, string>; // jsonb LangMap
  page_type: 'page' | 'board';
  content: Record<string, string>; // jsonb LangMap
  board_write_role: 'admin' | 'user';
  show_in_nav: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface PostRow {
  id: string;
  menu_id: string;
  title: string;
  content: string;
  author_name: string;
  author_id: string | null;
  is_admin_post: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}
