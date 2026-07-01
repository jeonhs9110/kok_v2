/**
 * Preferred-order fallback for admin-authored bilingual fields.
 *
 * Storefront components across Header / Footer / MenuPage / product
 * breadcrumbs used to write `field[lang] || field.kr` — which meant
 * a /en visitor viewing content the admin never translated into
 * English got the Korean text silently. Round 20's i18n audit
 * flagged 6+ files with this shape.
 *
 * The correct chain for a non-KR visitor is: their language first,
 * then English second (better generic fallback than untranslated
 * Korean), then Korean as a last resort. For a KR visitor the chain
 * degenerates to `.kr → .en` which matches the old behaviour.
 */
export function pickI18n(
  field: Record<string, string> | null | undefined,
  lang: string,
  fallback: string = '',
): string {
  if (!field) return fallback;
  const primary = field[lang];
  if (primary && primary.trim()) return primary;
  const en = field.en;
  if (en && en.trim()) return en;
  const kr = field.kr;
  if (kr && kr.trim()) return kr;
  return fallback;
}

/**
 * Same preferred-order chain, but returns an EMPTY string instead
 * of falling back across languages. Use for surfaces where a blank
 * value is preferable to a wrong-language leak — footer PIPA
 * disclosure, business info, etc., where the Korean company name
 * showing on the /en storefront is misleading rather than helpful.
 */
export function pickI18nStrict(
  field: Record<string, string> | null | undefined,
  lang: string,
): string {
  if (!field) return '';
  const primary = field[lang];
  if (primary && primary.trim()) return primary;
  if (lang === 'en') {
    const en = field.en;
    if (en && en.trim()) return en;
  }
  if (lang === 'kr') {
    const kr = field.kr;
    if (kr && kr.trim()) return kr;
  }
  return '';
}
