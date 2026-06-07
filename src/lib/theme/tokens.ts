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
   * Header navigation menu font size. CSS length value (e.g. "13.5px",
   * "15px"). Drives both the desktop top-nav links and the mobile drawer
   * via the --header-menu-font-size variable. Added 2026-06 after 한송이
   * relayed customer feedback that the menu text felt too small.
   */
  header_menu_font_size: string;
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
  header_menu_font_size: '13.5px',
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
    header_menu_font_size: partial.header_menu_font_size || DEFAULT_THEME_TOKENS.header_menu_font_size,
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
  ];
  if (t.font_body) lines.push(`--font-body: ${t.font_body};`);
  if (t.font_display) lines.push(`--font-display: ${t.font_display};`);
  return `:root { ${lines.join(' ')} }`;
}
