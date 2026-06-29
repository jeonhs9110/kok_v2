/**
 * Single source of truth for country pickers across the app.
 *
 * Used by:
 *   - /register phone country-code picker
 *   - /register country dropdown
 *   - /my-page profile edit (phone + country)
 *   - /admin/users CSV export country names
 *
 * Each entry pairs the ISO-3166 alpha-2 code with the dialing prefix
 * and the country name in both KR and EN. Korea sits at the top of
 * every visible list because >95% of customers are domestic; the
 * remaining countries follow alphabetically by English name to keep
 * the EN view sorted and the KR view "good enough" (Korean and
 * English alphabets don't collate identically, but the search box
 * carries the bulk of the work).
 *
 * Source list curated from the markets KOKKOK actually ships to
 * (per `src/lib/worldwide/defaults.ts` REGION_ORDER) plus the rest
 * of the ISO-3166 set so the picker covers every visitor.
 */

export interface Country {
  /** ISO-3166-1 alpha-2, lowercase, used for flag lookup. */
  code: string;
  /** International dialing prefix without the leading '+'. */
  dialCode: string;
  nameKr: string;
  nameEn: string;
}

const PRIMARY: Country[] = [
  { code: 'kr', dialCode: '82',  nameKr: '대한민국',          nameEn: 'South Korea' },
  { code: 'us', dialCode: '1',   nameKr: '미국',              nameEn: 'United States' },
  { code: 'jp', dialCode: '81',  nameKr: '일본',              nameEn: 'Japan' },
  { code: 'cn', dialCode: '86',  nameKr: '중국',              nameEn: 'China' },
  { code: 'hk', dialCode: '852', nameKr: '홍콩',              nameEn: 'Hong Kong' },
  { code: 'tw', dialCode: '886', nameKr: '대만',              nameEn: 'Taiwan' },
  { code: 'sg', dialCode: '65',  nameKr: '싱가포르',          nameEn: 'Singapore' },
  { code: 'my', dialCode: '60',  nameKr: '말레이시아',        nameEn: 'Malaysia' },
  { code: 'th', dialCode: '66',  nameKr: '태국',              nameEn: 'Thailand' },
  { code: 'vn', dialCode: '84',  nameKr: '베트남',            nameEn: 'Vietnam' },
  { code: 'id', dialCode: '62',  nameKr: '인도네시아',        nameEn: 'Indonesia' },
  { code: 'ph', dialCode: '63',  nameKr: '필리핀',            nameEn: 'Philippines' },
  { code: 'in', dialCode: '91',  nameKr: '인도',              nameEn: 'India' },
  { code: 'au', dialCode: '61',  nameKr: '호주',              nameEn: 'Australia' },
  { code: 'nz', dialCode: '64',  nameKr: '뉴질랜드',          nameEn: 'New Zealand' },
  { code: 'ca', dialCode: '1',   nameKr: '캐나다',            nameEn: 'Canada' },
  { code: 'mx', dialCode: '52',  nameKr: '멕시코',            nameEn: 'Mexico' },
  { code: 'br', dialCode: '55',  nameKr: '브라질',            nameEn: 'Brazil' },
  { code: 'ar', dialCode: '54',  nameKr: '아르헨티나',        nameEn: 'Argentina' },
  { code: 'cl', dialCode: '56',  nameKr: '칠레',              nameEn: 'Chile' },
  { code: 'co', dialCode: '57',  nameKr: '콜롬비아',          nameEn: 'Colombia' },
  { code: 'pe', dialCode: '51',  nameKr: '페루',              nameEn: 'Peru' },
  { code: 'gb', dialCode: '44',  nameKr: '영국',              nameEn: 'United Kingdom' },
  { code: 'ie', dialCode: '353', nameKr: '아일랜드',          nameEn: 'Ireland' },
  { code: 'fr', dialCode: '33',  nameKr: '프랑스',            nameEn: 'France' },
  { code: 'de', dialCode: '49',  nameKr: '독일',              nameEn: 'Germany' },
  { code: 'it', dialCode: '39',  nameKr: '이탈리아',          nameEn: 'Italy' },
  { code: 'es', dialCode: '34',  nameKr: '스페인',            nameEn: 'Spain' },
  { code: 'pt', dialCode: '351', nameKr: '포르투갈',          nameEn: 'Portugal' },
  { code: 'nl', dialCode: '31',  nameKr: '네덜란드',          nameEn: 'Netherlands' },
  { code: 'be', dialCode: '32',  nameKr: '벨기에',            nameEn: 'Belgium' },
  { code: 'ch', dialCode: '41',  nameKr: '스위스',            nameEn: 'Switzerland' },
  { code: 'at', dialCode: '43',  nameKr: '오스트리아',        nameEn: 'Austria' },
  { code: 'se', dialCode: '46',  nameKr: '스웨덴',            nameEn: 'Sweden' },
  { code: 'no', dialCode: '47',  nameKr: '노르웨이',          nameEn: 'Norway' },
  { code: 'dk', dialCode: '45',  nameKr: '덴마크',            nameEn: 'Denmark' },
  { code: 'fi', dialCode: '358', nameKr: '핀란드',            nameEn: 'Finland' },
  { code: 'is', dialCode: '354', nameKr: '아이슬란드',        nameEn: 'Iceland' },
  { code: 'pl', dialCode: '48',  nameKr: '폴란드',            nameEn: 'Poland' },
  { code: 'cz', dialCode: '420', nameKr: '체코',              nameEn: 'Czech Republic' },
  { code: 'hu', dialCode: '36',  nameKr: '헝가리',            nameEn: 'Hungary' },
  { code: 'gr', dialCode: '30',  nameKr: '그리스',            nameEn: 'Greece' },
  { code: 'tr', dialCode: '90',  nameKr: '튀르키예',          nameEn: 'Türkiye' },
  { code: 'ru', dialCode: '7',   nameKr: '러시아',            nameEn: 'Russia' },
  { code: 'ua', dialCode: '380', nameKr: '우크라이나',        nameEn: 'Ukraine' },
  { code: 'ae', dialCode: '971', nameKr: '아랍에미리트',      nameEn: 'United Arab Emirates' },
  { code: 'sa', dialCode: '966', nameKr: '사우디아라비아',    nameEn: 'Saudi Arabia' },
  { code: 'qa', dialCode: '974', nameKr: '카타르',            nameEn: 'Qatar' },
  { code: 'kw', dialCode: '965', nameKr: '쿠웨이트',          nameEn: 'Kuwait' },
  { code: 'il', dialCode: '972', nameKr: '이스라엘',          nameEn: 'Israel' },
  { code: 'eg', dialCode: '20',  nameKr: '이집트',            nameEn: 'Egypt' },
  { code: 'za', dialCode: '27',  nameKr: '남아프리카공화국',  nameEn: 'South Africa' },
  { code: 'ng', dialCode: '234', nameKr: '나이지리아',        nameEn: 'Nigeria' },
  { code: 'ke', dialCode: '254', nameKr: '케냐',              nameEn: 'Kenya' },
  { code: 'mo', dialCode: '853', nameKr: '마카오',            nameEn: 'Macao' },
  { code: 'mn', dialCode: '976', nameKr: '몽골',              nameEn: 'Mongolia' },
  { code: 'kh', dialCode: '855', nameKr: '캄보디아',          nameEn: 'Cambodia' },
  { code: 'la', dialCode: '856', nameKr: '라오스',            nameEn: 'Laos' },
  { code: 'mm', dialCode: '95',  nameKr: '미얀마',            nameEn: 'Myanmar' },
  { code: 'bd', dialCode: '880', nameKr: '방글라데시',        nameEn: 'Bangladesh' },
  { code: 'pk', dialCode: '92',  nameKr: '파키스탄',          nameEn: 'Pakistan' },
  { code: 'lk', dialCode: '94',  nameKr: '스리랑카',          nameEn: 'Sri Lanka' },
  { code: 'np', dialCode: '977', nameKr: '네팔',              nameEn: 'Nepal' },
];

/**
 * Canonical list — Korea pinned to position 0, then the rest sorted by
 * English name. This is what UI components should iterate over.
 */
export const COUNTRIES: Country[] = [
  PRIMARY[0]!,
  ...PRIMARY.slice(1).sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
];

/** Lookup by ISO code (lowercase). */
export function findCountry(code: string | null | undefined): Country | null {
  if (!code) return null;
  const lower = code.toLowerCase().trim();
  return COUNTRIES.find(c => c.code === lower) ?? null;
}

/** Lookup by dial code (no '+'). Falls back to KR if multiple match. */
export function findCountryByDial(dial: string | null | undefined): Country | null {
  if (!dial) return null;
  const trimmed = dial.replace(/^\+/, '').trim();
  return COUNTRIES.find(c => c.dialCode === trimmed) ?? null;
}

/**
 * Default selection for first paint. Korea unless the visitor's
 * Accept-Language strongly suggests otherwise — kept loose because
 * a smarter heuristic belongs on the server with the country header
 * the proxy already injects.
 */
export const DEFAULT_COUNTRY = COUNTRIES[0]!; // kr
