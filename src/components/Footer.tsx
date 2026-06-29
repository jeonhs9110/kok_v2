import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { translations, type TranslationKey } from '@/lib/i18n/translations';
import { safeUrl } from '@/lib/url/safeUrl';
import type { Lang } from '@/lib/i18n/types';

/**
 * Footer — server component.
 *
 * Was a `'use client'` component that fetched `business_info` on mount and
 * carried its own 5-minute in-memory cache. The data never changes inside a
 * single page view, so client-side fetching just delayed the first paint
 * and shipped an unused effect + Supabase JS bundle into the browser. Now
 * the data is fetched server-side and the markup is rendered directly into
 * the HTML, eliminating the network round-trip + hydration mismatch risk.
 *
 * Caching: `unstable_cache` with a 5-minute TTL replaces the module-level
 * memo the client component used. Same effective freshness, but the cache
 * is process-shared instead of per-tab, so a single admin edit propagates
 * to every visitor on next revalidate.
 *
 * i18n: server components can't use the `useI18n()` hook, so we look up
 * translations directly from the `translations` map using the `lang` prop
 * forwarded by `[lang]/layout.tsx`.
 */

const BRAND = 'KOKKOK GARDEN';

interface BusinessInfo {
  company_name_kr: string;
  company_name_en: string;
  ceo_name: string;
  business_reg_number: string;
  mail_order_number: string;
  address_kr: string;
  address_en: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  instagram_url: string;
  youtube_url: string;
  cs_hours_kr: string;
  cs_hours_en: string;
  cs_lunch_kr: string;
  cs_lunch_en: string;
  cs_holiday_kr: string;
  cs_holiday_en: string;
  hidden_fields?: string[] | null;
}

// Public anon client kept only for the Supabase fallback path when
// USE_RDS != 'true'. The RDS path goes through the dispatcher in
// getCachedBusinessInfo below and never touches this client.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const publicClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const getCachedBusinessInfo = unstable_cache(
  async (): Promise<BusinessInfo | null> => {
    if (process.env.USE_RDS === 'true') {
      try {
        const { getBusinessInfoFromPg } = await import('@/lib/db/storefront-reads');
        const row = await getBusinessInfoFromPg();
        return (row as unknown as BusinessInfo | null) ?? null;
      } catch (err) {
        console.error('[Footer] business_info pg fetch failed:', err);
        return null;
      }
    }
    if (!publicClient) {
      console.error('[Footer] Supabase env missing — business_info unavailable');
      return null;
    }
    try {
      const { data, error } = await publicClient
        .from('business_info')
        .select('*')
        .maybeSingle();
      if (error) {
        console.error('[Footer] business_info load failed:', error);
        return null;
      }
      return (data as BusinessInfo | null) ?? null;
    } catch (err) {
      console.error('[Footer] business_info threw:', err);
      return null;
    }
  },
  ['footer:business-info'],
  { revalidate: 300, tags: ['business_info'] }
);

function t(lang: Lang, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations['en'][key] ?? key;
}

export default async function Footer({ lang }: { lang: Lang }) {
  const biz = await getCachedBusinessInfo();

  const hidden = biz?.hidden_fields ?? [];
  const showCompany = !hidden.includes('company');
  const showAddress = !hidden.includes('address');
  const showEmail   = !hidden.includes('email');
  const showPhone   = !hidden.includes('phone');
  const showCsHours = !hidden.includes('cs_hours');
  const showBank    = !hidden.includes('bank');
  const showSocial  = !hidden.includes('social');

  const isKr = lang === 'kr';
  const companyName = (isKr ? biz?.company_name_kr : biz?.company_name_en) || biz?.company_name_kr || BRAND;
  const address     = (isKr ? biz?.address_kr     : biz?.address_en)     || biz?.address_kr     || '';
  const csHours     = (isKr ? biz?.cs_hours_kr    : biz?.cs_hours_en)    || biz?.cs_hours_kr    || '';
  const csLunch     = (isKr ? biz?.cs_lunch_kr    : biz?.cs_lunch_en)    || biz?.cs_lunch_kr    || '';
  const csHoliday   = (isKr ? biz?.cs_holiday_kr  : biz?.cs_holiday_en)  || biz?.cs_holiday_kr  || '';

  const repLabel       = isKr ? '대표' : 'CEO';
  const telLabel       = isKr ? '전화' : 'Tel';
  const bizNumLabel    = isKr ? '사업자등록번호' : 'Business Reg. No.';
  const mailOrderLabel = isKr ? '통신판매업신고번호' : 'Mail-Order Reg.';
  const addressLabel   = isKr ? '주소' : 'Address';
  const emailLabel     = isKr ? '이메일' : 'Email';
  const holderLabel    = isKr ? '예금주' : 'Account Holder';
  const pocLabel       = isKr ? '개인정보보호책임자' : 'Privacy Officer';

  // 전자상거래법 §13 + PIPA §31 require an always-visible business
  // registration number, mail-order number, and privacy officer in the
  // footer. When the operator hasn't populated business_info yet, show
  // a single notice that surfaces the gap rather than silently rendering
  // blank — operators sometimes forget to fill the row in until the KFTC
  // does a compliance audit.
  const hasAnyBusinessInfo = !!(
    biz?.company_name_kr ||
    biz?.business_reg_number ||
    biz?.mail_order_number ||
    biz?.ceo_name
  );
  // Use the type-via-cast escape hatch: the privacy officer fields live
  // on the seed schema but aren't in the Footer's narrow BusinessInfo
  // interface yet. Read them defensively.
  const officerName = (biz as unknown as { privacy_officer_name?: string } | null | undefined)?.privacy_officer_name ?? '';
  const officerEmail = (biz as unknown as { privacy_officer_email?: string } | null | undefined)?.privacy_officer_email ?? '';

  return (
    <footer className="bg-white border-t border-neutral-200 py-16 text-brand-ink" data-builder-section="footer">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row justify-between lg:space-x-12 space-y-12 lg:space-y-0">

          {/* Company info */}
          <div className="flex-1 max-w-sm">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6">{BRAND}</h2>
            <div className="space-y-2 text-[13px] text-brand-muted leading-relaxed break-keep">
              {showCompany && companyName && <p>{isKr ? '상호' : 'Company'}: {companyName}</p>}
              {showCompany && (biz?.ceo_name || biz?.phone) && (
                <p>
                  {biz?.ceo_name && <>{repLabel}: {biz.ceo_name}</>}
                  {biz?.ceo_name && biz?.phone && ' | '}
                  {biz?.phone && <>{telLabel}: {biz.phone}</>}
                </p>
              )}
              {showCompany && biz?.business_reg_number && <p>{bizNumLabel}: {biz.business_reg_number}</p>}
              {showCompany && biz?.mail_order_number && <p>{mailOrderLabel}: {biz.mail_order_number}</p>}
              {showAddress && address && <p>{addressLabel}: {address}</p>}
              {showEmail && biz?.email && <p>{emailLabel}: {biz.email}</p>}
              {/* Privacy officer disclosure — PIPA §31 requires this on
                  every page, not just the privacy policy. */}
              {(officerName || officerEmail) && (
                <p>{pocLabel}: {[officerName, officerEmail].filter(Boolean).join(' / ')}</p>
              )}
              {/* If business_info is fully empty, surface a single
                  visible notice so operators don't ship a footer that
                  silently violates 전자상거래법 §13. */}
              {!hasAnyBusinessInfo && isKr && (
                <p className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-[11px]">
                  ⚠ 사업자 정보가 등록되지 않았습니다. 관리자 → 법적 페이지에서 입력해주세요.
                </p>
              )}
              <p className="mt-4 pt-4 border-t border-neutral-100">© {BRAND} All Rights Reserved.</p>
            </div>
            <div className="flex space-x-4 mt-6 text-[12px] font-semibold flex-wrap gap-y-2">
              <Link href={`/${lang}/menus/about`} className="hover:underline">{t(lang, 'footer.about')}</Link>
              <Link href={`/${lang}/terms`} className="hover:underline">{t(lang, 'footer.terms')}</Link>
              <Link href={`/${lang}/privacy`} className="hover:underline text-brand-ink font-bold">{t(lang, 'footer.privacy')}</Link>
            </div>
            {showSocial && (biz?.instagram_url || biz?.youtube_url) && (
              <div className="flex items-center space-x-3 mt-6">
                {biz?.instagram_url && (
                  <a
                    href={safeUrl(biz.instagram_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
                  >
                    <span className="text-[10px] font-bold text-neutral-600">IG</span>
                  </a>
                )}
                {biz?.youtube_url && (
                  <a
                    href={safeUrl(biz.youtube_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube"
                    className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
                  >
                    <span className="text-[10px] font-bold text-neutral-600">YT</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Customer center */}
          {(showPhone || showCsHours) && (
            <div className="flex-1 lg:pl-12">
              <h3 className="text-[13px] font-bold tracking-widest mb-6">{t(lang, 'footer.ccTitle')}</h3>
              {showPhone && (
                biz?.phone ? (
                  <div className="text-3xl font-extrabold tracking-tighter mb-4 text-brand-ink">{biz.phone}</div>
                ) : (
                  <div className="text-3xl font-extrabold tracking-tighter mb-4 text-neutral-300">—</div>
                )
              )}
              {showCsHours && (
                <div className="text-[13px] text-brand-muted space-y-1">
                  {csHours && <p>{csHours}</p>}
                  {csLunch && <p>{csLunch}</p>}
                  {csHoliday && <p>{csHoliday}</p>}
                </div>
              )}
            </div>
          )}

          {/* Bank info — only renders when both the admin toggle is on AND
              there's actual bank data. Social icons live in the brand
              column now so this column never displays an orphan icon when
              bank is hidden. */}
          {showBank && (biz?.bank_name || biz?.bank_account || biz?.bank_holder) && (
            <div className="flex-1 lg:pl-12">
              <h3 className="text-[13px] font-bold tracking-widest mb-6">{t(lang, 'footer.bankTitle')}</h3>
              <div className="text-[13px] text-brand-muted space-y-1">
                {(biz?.bank_name || biz?.bank_account) && (
                  <p>
                    {biz?.bank_name}
                    {biz?.bank_name && biz?.bank_account && ' '}
                    {biz?.bank_account}
                  </p>
                )}
                {biz?.bank_holder && <p className="mt-4">{holderLabel}: {biz.bank_holder}</p>}
              </div>
            </div>
          )}

        </div>
      </div>
    </footer>
  );
}
