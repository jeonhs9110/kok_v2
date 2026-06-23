/**
 * Theme tokens — single source of truth for the brand palette + typography +
 * a few visual knobs the admin can change without code.
 *
 * The defaults here match the @theme block in src/app/globals.css. The
 * admin can override any token via /admin/theme; overrides are persisted
 * in the `site_settings` row with `key='theme_tokens'` and injected
 * as a <style> tag by [lang]/layout.tsx on the storefront.
 *
 * Adding a new token:
 *
 *   1. Add the key to `ThemeTokens` below + give it a default value
 *      in `DEFAULT_THEME_TOKENS`.
 *   2. Add a corresponding `--css-var: <value>` mapping in
 *      `tokensToCss()` so the injection writes it.
 *   3. (Optional) Reference it from globals.css's @theme block so
 *      Tailwind utilities pick it up.
 *   4. Add an editor row in src/app/admin/theme/page.tsx.
 */

export interface ThemeTokens {
  color_brand_ink: string;
  color_brand_accent: string;
  color_brand_muted: string;
  color_brand_primary: string;
  color_brand_notice_from: string;
  color_brand_notice_to: string;
  /** CSS length for button border-radius — "0px" for sharp, "9999px" for pill */
  radius_button: string;
  /** Font-family string for body text. Empty falls through to the default stack. */
  font_body: string;
  /** Font-family string for display / headings. Empty falls through. */
  font_display: string;
  /**
   * Font-family for the top-nav menu + the text-fallback logo. Empty
   * falls through to the body font, matching pre-token behavior.
   * Added at the 2026-06-10 boss meeting so the header can carry a
   * different tone (e.g. serif) from the body copy.
   */
  font_header: string;
  /**
   * Font-family for CTA buttons site-wide. Targets the same selectors
   * the existing radius_button rule pins (every <button> / [role=button]
   * that doesn't opt out via .kokkok-keep-font). Empty falls through
   * to the body font.
   */
  font_button: string;
  /**
   * Font-family for product prices and other tabular numerics. Drives
   * the .kokkok-price class wired on ProductCard's price spans.
   * Empty falls through to the body font.
   */
  font_price: string;
  /**
   * Header navigation menu font size. CSS length value (e.g. "13.5px",
   * "15px"). Drives both the desktop top-nav links and the mobile drawer
   * via the --header-menu-font-size variable. Added 2026-06 after the
   * operator relayed customer feedback that the menu text felt too small.
   */
  header_menu_font_size: string;
  /**
   * Header dropdown submenu items (카멜리아 / 앰플세럼 / 크림 under Product,
   * and any dynamic menu's child links). Operator's 2026-06-17 ask: the
   * "헤더 메뉴 글자 크기" slider works for the top labels but the second
   * row of items underneath stayed hardcoded. This token feeds the
   * --header-submenu-font-size CSS var consumed by .kokkok-header-submenu.
   */
  header_submenu_font_size: string;
  /**
   * Header logo height. CSS length value (e.g. "40px"). Drives the
   * <img class="kokkok-header-logo"> in src/components/Header.tsx.
   * Added 2026-06-09 so /admin/logo can offer 작게/기본/크게/더 크게
   * presets next to the file upload control.
   */
  header_logo_height: string;
  /**
   * Optional cap on the logo's horizontal width. CSS length (e.g.
   * "200px") or empty for "no constraint" (current default). Added
   * 2026-06-24 — when the operator increased logo height the wider
   * logo image was pushing the nav menu to the right because the
   * default `width: auto` honored the natural aspect ratio. Setting
   * this cap clamps width independently of height; `object-fit:
   * contain` makes the image scale down inside the box if its
   * natural aspect would exceed the cap.
   */
  header_logo_max_width: string;
  /**
   * SubHero banner subtitle font size — the line above the big title
   * inside SubHeroBanner.tsx. Bosses asked at 2026-06-10 to bump the
   * default and add a global knob; this token feeds the
   * --subhero-subtitle-size CSS var consumed by .kokkok-subhero-subtitle.
   * Per-banner offsets in /admin/sub-hero still stack on top of this.
   */
  subhero_subtitle_size: string;
  /**
   * Main hero carousel height — three breakpoints to match what the
   * storefront actually uses. Pre-token values were hardcoded as
   * h-[700px] sm:h-[900px] lg:h-[1000px] inside HeroSlider.tsx.
   * Bosses asked at the 2026-06-10 follow-up to make the banner size
   * admin-tunable so the brand can dial down on shorter campaigns
   * without a code release.
   */
  hero_height_mobile: string;
  hero_height_tablet: string;
  hero_height_desktop: string;
  /**
   * Optional max-width cap on the hero region. Empty string -> uncapped
   * (full viewport width). Useful when the brand wants a centered band
   * with letterbox margins on ultra-wide monitors.
   */
  hero_max_width: string;
  /**
   * "BEST SELLER" / "추천 상품" style product-section title. Drives the
   * h2 on the homepage's pickBestSellers section + any future section
   * that opts in via .kokkok-product-section-title. Added 2026-06-10.
   */
  product_section_title_size: string;
  /**
   * ProductCard's product-name <h3>. Drives every product card in the
   * site via .kokkok-product-name. The bosses called out the homepage
   * BEST SELLER row as too small at 2026-06-10.
   */
  product_name_size: string;
  /**
   * ProductCard price span + discount %. Pairs with the .kokkok-price
   * font-family set under font_price (the family vs size is split so
   * an admin can swap one without touching the other).
   */
  product_price_size: string;
  /**
   * Summary text under the product name inside the homepage BEST SELLER
   * cards. Scoped to .kokkok-home-products so the /products listing
   * keeps its compact baseline. Added 2026-06-10 boss-meeting follow-up.
   */
  home_product_summary_size: string;
  /**
   * Aspect ratio of the product card image inside the homepage
   * BEST SELLER row. CSS aspect-ratio string ("5/6", "1/1", etc).
   * Empty falls through to the storefront default 5/6 (Tailwind
   * aspect-[5/6]). Bumping the second number makes images visually
   * taller / more imposing — admin's lever for "make the products
   * row read bigger".
   */
  home_product_image_ratio: string;
  /**
   * Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX"). When set,
   * [lang]/layout.tsx injects the gtag.js script so storefront visits
   * land in GA4 alongside the in-house analytics. Empty = no GA script
   * loaded (default, current behavior).
   *
   * Stored as a theme token because /admin/theme is the existing
   * "site-wide setting" page and adding a separate admin route just
   * for one field is overkill. Semantically it's not a "theme" thing
   * but reuses the save flow + same JSONB row for free.
   */
  ga_measurement_id: string;
}

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  color_brand_ink: '#111111',
  color_brand_accent: '#d94a18',
  color_brand_muted: '#6b7280',
  color_brand_primary: '#00693a',
  color_brand_notice_from: '#4a7ab5',
  color_brand_notice_to: '#6b9fd4',
  radius_button: '0px',
  font_body: '',
  font_display: '',
  font_header: '',
  font_button: '',
  font_price: '',
  // Bumped 2026-06-08 from 13.5px to 15px after the operator forwarded customer
  // feedback that the homepage menu read too small. Admins can still pin
  // any preset (13.5 / 15 / 17 / 19) from /admin/theme; this only moves
  // the out-of-box value for installs without a saved row.
  header_menu_font_size: '15px',
  // 12.5px matches the pre-token Tailwind text-[12.5px] in Header.tsx
  // for dropdown submenu items. Admin slider 9–24 covers the range
  // operators have asked for. Bumping this also widens the dropdown
  // mega-menu height because items wrap less aggressively.
  header_submenu_font_size: '12.5px',
  // 56px default — bosses asked for a larger logo at 2026-06-10 meeting;
  // admins can still pin any preset (32/40/48/56) or any pixel value
  // 20–80 from /admin/logo. Saved rows keep their override.
  header_logo_height: '56px',
  // Empty default = no width constraint (current behavior). Operators
  // who hit "logo pushes nav right when bigger" pick a cap (120/160/
  // 200/240 presets or a custom px).
  header_logo_max_width: '',
  // 18px default — bosses said the sub-header read too small at the
  // 2026-06-10 meeting. Bumped from the pre-token 14/16px Tailwind
  // text-sm/md:text-base pair so a fresh install lands at 18px both
  // breakpoints; /admin/theme can dial down or up (12–28).
  subhero_subtitle_size: '18px',
  // Defaults match the pre-token Tailwind classes (h-[700px] sm:h-[900px]
  // lg:h-[1000px]) so existing installs paint identically to before.
  hero_height_mobile: '700px',
  hero_height_tablet: '900px',
  hero_height_desktop: '1000px',
  // Empty -> uncapped (matches today). When set, HeroSlider centers
  // the carousel under a max-w wrapper at the given CSS length.
  hero_max_width: '',
  // 24px matches the pre-token text-2xl for the BEST SELLER heading.
  // Bumping defaults here would shift the homepage on every install;
  // keep parity, let admin pick from /admin/theme.
  product_section_title_size: '24px',
  // 15px (vs. pre-token 13px) — bosses said the product names on the
  // homepage looked small next to the bigger BEST SELLER row above.
  product_name_size: '15px',
  // 17px (vs. pre-token 15px) — same reason; prices read alongside
  // the bumped product name without looking cramped.
  product_price_size: '17px',
  // 12px matches the existing hardcoded text-[12px] on ProductCard's
  // summary so installs without a saved row look identical.
  home_product_summary_size: '12px',
  // Default 5/6 matches the storefront's existing Tailwind
  // aspect-[5/6] so existing installs paint identically.
  home_product_image_ratio: '5/6',
  // Empty = no GA script loaded. Operator pastes G-XXXXXXXXXX from
  // their GA4 property settings on /admin/theme.
  ga_measurement_id: '',
};

export function parseThemeTokens(raw: unknown): ThemeTokens {
  if (typeof raw === 'string') {
    try {
      return parseThemeTokens(JSON.parse(raw));
    } catch {
      return DEFAULT_THEME_TOKENS;
    }
  }
  if (!raw || typeof raw !== 'object') return DEFAULT_THEME_TOKENS;
  const partial = raw as Partial<ThemeTokens>;
  return {
    color_brand_ink: partial.color_brand_ink || DEFAULT_THEME_TOKENS.color_brand_ink,
    color_brand_accent: partial.color_brand_accent || DEFAULT_THEME_TOKENS.color_brand_accent,
    color_brand_muted: partial.color_brand_muted || DEFAULT_THEME_TOKENS.color_brand_muted,
    color_brand_primary: partial.color_brand_primary || DEFAULT_THEME_TOKENS.color_brand_primary,
    color_brand_notice_from: partial.color_brand_notice_from || DEFAULT_THEME_TOKENS.color_brand_notice_from,
    color_brand_notice_to: partial.color_brand_notice_to || DEFAULT_THEME_TOKENS.color_brand_notice_to,
    radius_button: partial.radius_button ?? DEFAULT_THEME_TOKENS.radius_button,
    font_body: partial.font_body ?? '',
    font_display: partial.font_display ?? '',
    font_header: partial.font_header ?? '',
    font_button: partial.font_button ?? '',
    font_price: partial.font_price ?? '',
    header_menu_font_size: partial.header_menu_font_size || DEFAULT_THEME_TOKENS.header_menu_font_size,
    header_submenu_font_size: partial.header_submenu_font_size || DEFAULT_THEME_TOKENS.header_submenu_font_size,
    header_logo_height: partial.header_logo_height || DEFAULT_THEME_TOKENS.header_logo_height,
    header_logo_max_width: partial.header_logo_max_width ?? '',
    subhero_subtitle_size: partial.subhero_subtitle_size || DEFAULT_THEME_TOKENS.subhero_subtitle_size,
    product_section_title_size: partial.product_section_title_size || DEFAULT_THEME_TOKENS.product_section_title_size,
    product_name_size: partial.product_name_size || DEFAULT_THEME_TOKENS.product_name_size,
    product_price_size: partial.product_price_size || DEFAULT_THEME_TOKENS.product_price_size,
    home_product_summary_size: partial.home_product_summary_size || DEFAULT_THEME_TOKENS.home_product_summary_size,
    home_product_image_ratio: partial.home_product_image_ratio || DEFAULT_THEME_TOKENS.home_product_image_ratio,
    hero_height_mobile: partial.hero_height_mobile || DEFAULT_THEME_TOKENS.hero_height_mobile,
    hero_height_tablet: partial.hero_height_tablet || DEFAULT_THEME_TOKENS.hero_height_tablet,
    hero_height_desktop: partial.hero_height_desktop || DEFAULT_THEME_TOKENS.hero_height_desktop,
    hero_max_width: partial.hero_max_width ?? '',
    ga_measurement_id: partial.ga_measurement_id ?? '',
  };
}

/**
 * Convert tokens into a `:root { --…: …; }` CSS rule. Skip empty fonts so
 * the @theme defaults from globals.css apply for those.
 */
export function tokensToCss(t: ThemeTokens): string {
  const lines: string[] = [
    `--color-brand-ink: ${t.color_brand_ink};`,
    `--color-brand-accent: ${t.color_brand_accent};`,
    `--color-brand-muted: ${t.color_brand_muted};`,
    `--color-brand-primary: ${t.color_brand_primary};`,
    `--color-brand-notice-from: ${t.color_brand_notice_from};`,
    `--color-brand-notice-to: ${t.color_brand_notice_to};`,
    `--radius-button: ${t.radius_button};`,
    `--header-menu-font-size: ${t.header_menu_font_size};`,
    `--header-submenu-font-size: ${t.header_submenu_font_size};`,
    `--header-logo-height: ${t.header_logo_height};`,
    `--subhero-subtitle-size: ${t.subhero_subtitle_size};`,
    `--product-section-title-size: ${t.product_section_title_size};`,
    `--product-name-size: ${t.product_name_size};`,
    `--product-price-size: ${t.product_price_size};`,
    `--home-product-summary-size: ${t.home_product_summary_size};`,
    `--home-product-image-ratio: ${t.home_product_image_ratio};`,
    `--hero-height-mobile: ${t.hero_height_mobile};`,
    `--hero-height-tablet: ${t.hero_height_tablet};`,
    `--hero-height-desktop: ${t.hero_height_desktop};`,
  ];
  // Empty hero_max_width -> no var emission -> CSS falls through to
  // "none" so the carousel stays full-width on every viewport. Setting
  // a value makes .kokkok-hero-region pick up the cap.
  if (t.hero_max_width) lines.push(`--hero-max-width: ${t.hero_max_width};`);
  // Empty header_logo_max_width -> no var emission -> CSS falls through
  // to `max-width: none` so the logo's natural width is unconstrained
  // (pre-2026-06-24 behavior). Setting a value clamps the logo width.
  if (t.header_logo_max_width) lines.push(`--header-logo-max-width: ${t.header_logo_max_width};`);
  if (t.font_body) lines.push(`--font-body: ${t.font_body};`);
  if (t.font_display) lines.push(`--font-display: ${t.font_display};`);
  if (t.font_header) lines.push(`--font-header: ${t.font_header};`);
  if (t.font_button) lines.push(`--font-button: ${t.font_button};`);
  if (t.font_price) lines.push(`--font-price: ${t.font_price};`);
  return `:root { ${lines.join(' ')} }`;
}
