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
   * via the --header-menu-font-size variable. Added 2026-06 after 한송이
   * relayed customer feedback that the menu text felt too small.
   */
  header_menu_font_size: string;
  /**
   * Header logo height. CSS length value (e.g. "40px"). Drives the
   * <img class="kokkok-header-logo"> in src/components/Header.tsx.
   * Added 2026-06-09 so /admin/logo can offer 작게/기본/크게/더 크게
   * presets next to the file upload control.
   */
  header_logo_height: string;
  /**
   * SubHero banner subtitle font size — the line above the big title
   * inside SubHeroBanner.tsx. Bosses asked at 2026-06-10 to bump the
   * default and add a global knob; this token feeds the
   * --subhero-subtitle-size CSS var consumed by .kokkok-subhero-subtitle.
   * Per-banner offsets in /admin/sub-hero still stack on top of this.
   */
  subhero_subtitle_size: string;
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
  // Bumped 2026-06-08 from 13.5px to 15px after 송이 forwarded customer
  // feedback that the homepage menu read too small. Admins can still pin
  // any preset (13.5 / 15 / 17 / 19) from /admin/theme; this only moves
  // the out-of-box value for installs without a saved row.
  header_menu_font_size: '15px',
  // 56px default — bosses asked for a larger logo at 2026-06-10 meeting;
  // admins can still pin any preset (32/40/48/56) or any pixel value
  // 20–80 from /admin/logo. Saved rows keep their override.
  header_logo_height: '56px',
  // 18px default — bosses said the sub-header read too small at the
  // 2026-06-10 meeting. Bumped from the pre-token 14/16px Tailwind
  // text-sm/md:text-base pair so a fresh install lands at 18px both
  // breakpoints; /admin/theme can dial down or up (12–28).
  subhero_subtitle_size: '18px',
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
    header_logo_height: partial.header_logo_height || DEFAULT_THEME_TOKENS.header_logo_height,
    subhero_subtitle_size: partial.subhero_subtitle_size || DEFAULT_THEME_TOKENS.subhero_subtitle_size,
    product_section_title_size: partial.product_section_title_size || DEFAULT_THEME_TOKENS.product_section_title_size,
    product_name_size: partial.product_name_size || DEFAULT_THEME_TOKENS.product_name_size,
    product_price_size: partial.product_price_size || DEFAULT_THEME_TOKENS.product_price_size,
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
    `--header-logo-height: ${t.header_logo_height};`,
    `--subhero-subtitle-size: ${t.subhero_subtitle_size};`,
    `--product-section-title-size: ${t.product_section_title_size};`,
    `--product-name-size: ${t.product_name_size};`,
    `--product-price-size: ${t.product_price_size};`,
  ];
  if (t.font_body) lines.push(`--font-body: ${t.font_body};`);
  if (t.font_display) lines.push(`--font-display: ${t.font_display};`);
  if (t.font_header) lines.push(`--font-header: ${t.font_header};`);
  if (t.font_button) lines.push(`--font-button: ${t.font_button};`);
  if (t.font_price) lines.push(`--font-price: ${t.font_price};`);
  return `:root { ${lines.join(' ')} }`;
}
