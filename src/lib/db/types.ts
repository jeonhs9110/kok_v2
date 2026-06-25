// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.

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

export interface CarouselSlideRow {
  id: string;
  badge: Record<string, string> | null;
  title: Record<string, string> | null;
  subtitle: Record<string, string> | null;
  image_url: string | null;
  mobile_image_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  badge_bg_color: string | null;
  badge_text_color: string | null;
  title_size_offset: number | null;
  subtitle_size_offset: number | null;
  badge_size_offset: number | null;
  sort_order: number;
  is_active: boolean;
  link_url: string | null;
  display_mode: 'default' | 'fullpage' | null;
  media_type: 'image' | 'video' | 'gif' | null;
  badge_font_family: string | null;
  title_font_family: string | null;
  subtitle_font_family: string | null;
  badge_bold: boolean | null;
  badge_italic: boolean | null;
  badge_underline: boolean | null;
  title_bold: boolean | null;
  title_italic: boolean | null;
  title_underline: boolean | null;
  subtitle_bold: boolean | null;
  subtitle_italic: boolean | null;
  subtitle_underline: boolean | null;
  text_position: string | null;
  text_position_mobile: string | null;
  image_anchor: string | null;
  image_anchor_mobile: string | null;
  created_at: string;
}

export interface ReviewCardRow {
  id: string;
  image_url: string | null;
  title: string | null;
  content_html: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteSettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
}

export interface SiteBackgroundRow {
  id: string;
  file_url: string;
  file_type: 'image' | 'video';
  scroll_driven: boolean | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface HomepageBannerRow {
  id: string;
  text: Record<string, string> | null;
  link_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  is_active: boolean;
}

export interface ShortsRow {
  id: string;
  youtube_id: string;
  product_id: string | null;
  created_at: string;
}

export interface ShortsConfigRow {
  id: string;
  bg_type: string | null;
  bg_color: string | null;
  bg_media_url: string | null;
  bg_media_type: string | null;
  header_text: string | null;
  header_font_size: string | null;
  header_text_color: string | null;
  header_bg_color: string | null;
}

export interface InstagramConfigRow {
  id: number;
  handle: string | null;
  description: string | null;
  bg_type: string | null;
  bg_color: string | null;
  bg_media_url: string | null;
  bg_media_type: string | null;
  header_font_size: string | null;
  header_text_color: string | null;
  header_bg_color: string | null;
}

export interface InstagramPostRow {
  id: string;
  image_url: string | null;
  link_url: string | null;
  post_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PromoBannerRow {
  id: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SubHeroBannerRow {
  id: string;
  image_url: string | null;
  link_url: string | null;
  title: string | null;
  subtitle: string | null;
  title_size_offset: number | null;
  subtitle_size_offset: number | null;
  title_font_family: string | null;
  subtitle_font_family: string | null;
  title_bold: boolean | null;
  title_italic: boolean | null;
  title_underline: boolean | null;
  subtitle_bold: boolean | null;
  subtitle_italic: boolean | null;
  subtitle_underline: boolean | null;
  title_color: string | null;
  subtitle_color: string | null;
  text_position: string | null;
  text_position_mobile: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  content: string;
  is_admin_comment: boolean;
  created_at: string;
}

export interface BusinessInfoRow {
  id: string;
  company_name_kr: string | null;
  company_name_en: string | null;
  ceo_name: string | null;
  business_reg_number: string | null;
  mail_order_number: string | null;
  address_kr: string | null;
  address_en: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  cs_hours_kr: string | null;
  cs_hours_en: string | null;
  cs_lunch_kr: string | null;
  cs_lunch_en: string | null;
  cs_holiday_kr: string | null;
  cs_holiday_en: string | null;
  hidden_fields: string[] | null;
}

export interface LegalPageRow {
  id: string;
  slug: string;
  title_kr: string | null;
  title_en: string | null;
  content_kr: string | null;
  content_en: string | null;
  is_published: boolean;
  created_at: string;
}

export interface PageRow {
  id: string;
  slug: string;
  is_published: boolean;
  created_at: string;
}

export interface ProductReviewRow {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  content: string;
  is_published: boolean;
  created_at: string;
}
