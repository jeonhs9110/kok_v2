'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useI18n } from '@/lib/i18n/context';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
}

const BRAND = 'KOKKOK GARDEN';

export default function Footer() {
  const { t, lang } = useI18n();
  const [biz, setBiz] = useState<BusinessInfo | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('business_info')
          .select('*')
          .maybeSingle();
        if (data) setBiz(data as BusinessInfo);
      } catch {
        /* leave empty — footer falls back to blanks */
      }
    })();
  }, []);

  const isKr = lang === 'kr';
  const companyName = (isKr ? biz?.company_name_kr : biz?.company_name_en) || biz?.company_name_kr || BRAND;
  const address     = (isKr ? biz?.address_kr     : biz?.address_en)     || biz?.address_kr     || '';
  const csHours     = (isKr ? biz?.cs_hours_kr    : biz?.cs_hours_en)    || biz?.cs_hours_kr    || '';
  const csLunch     = (isKr ? biz?.cs_lunch_kr    : biz?.cs_lunch_en)    || biz?.cs_lunch_kr    || '';
  const csHoliday   = (isKr ? biz?.cs_holiday_kr  : biz?.cs_holiday_en)  || biz?.cs_holiday_kr  || '';

  const repLabel = isKr ? '대표' : 'CEO';
  const telLabel = isKr ? '전화' : 'Tel';
  const bizNumLabel = isKr ? '사업자등록번호' : 'Business Reg. No.';
  const mailOrderLabel = isKr ? '통신판매업신고번호' : 'Mail-Order Reg.';
  const addressLabel = isKr ? '주소' : 'Address';
  const emailLabel = isKr ? '이메일' : 'Email';
  const holderLabel = isKr ? '예금주' : 'Account Holder';

  return (
    <footer className="bg-white border-t border-neutral-200 py-16 text-[#333]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row justify-between lg:space-x-12 space-y-12 lg:space-y-0">

          {/* Company Info */}
          <div className="flex-1 max-w-sm">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6">{BRAND}</h2>
            <div className="space-y-2 text-[13px] text-neutral-500 leading-relaxed break-keep">
              {companyName && <p>{isKr ? '상호' : 'Company'}: {companyName}</p>}
              {(biz?.ceo_name || biz?.phone) && (
                <p>
                  {biz?.ceo_name && <>{repLabel}: {biz.ceo_name}</>}
                  {biz?.ceo_name && biz?.phone && ' | '}
                  {biz?.phone && <>{telLabel}: {biz.phone}</>}
                </p>
              )}
              {biz?.business_reg_number && <p>{bizNumLabel}: {biz.business_reg_number}</p>}
              {biz?.mail_order_number && <p>{mailOrderLabel}: {biz.mail_order_number}</p>}
              {address && <p>{addressLabel}: {address}</p>}
              {biz?.email && <p>{emailLabel}: {biz.email}</p>}
              <p className="mt-4 pt-4 border-t border-neutral-100">© {BRAND} All Rights Reserved.</p>
            </div>
            <div className="flex space-x-4 mt-6 text-[12px] font-semibold flex-wrap gap-y-2">
              <Link href={`/${lang}/about`} className="hover:underline">{t('footer.about')}</Link>
              <Link href={`/${lang}/terms`} className="hover:underline">{t('footer.terms')}</Link>
              <Link href={`/${lang}/privacy`} className="hover:underline text-black font-bold">{t('footer.privacy')}</Link>
            </div>
          </div>

          {/* Customer Center */}
          <div className="flex-1 lg:pl-12">
            <h3 className="text-[13px] font-bold tracking-widest mb-6">{t('footer.ccTitle')}</h3>
            {biz?.phone ? (
              <div className="text-3xl font-extrabold tracking-tighter mb-4 text-[#111]">{biz.phone}</div>
            ) : (
              <div className="text-3xl font-extrabold tracking-tighter mb-4 text-neutral-300">—</div>
            )}
            <div className="text-[13px] text-neutral-500 space-y-1">
              {csHours && <p>{csHours}</p>}
              {csLunch && <p>{csLunch}</p>}
              {csHoliday && <p>{csHoliday}</p>}
            </div>
          </div>

          {/* Bank Info */}
          <div className="flex-1 lg:pl-12">
            <h3 className="text-[13px] font-bold tracking-widest mb-6">{t('footer.bankTitle')}</h3>
            <div className="text-[13px] text-neutral-500 space-y-1">
              {(biz?.bank_name || biz?.bank_account) && (
                <p>
                  {biz?.bank_name}
                  {biz?.bank_name && biz?.bank_account && ' '}
                  {biz?.bank_account}
                </p>
              )}
              {biz?.bank_holder && <p className="mt-4">{holderLabel}: {biz.bank_holder}</p>}
            </div>
            <div className="flex items-center space-x-3 mt-8">
              {biz?.instagram_url && (
                <a
                  href={biz.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
                >
                  <span className="text-[10px] font-bold text-neutral-600">IG</span>
                </a>
              )}
              {biz?.youtube_url && (
                <a
                  href={biz.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
                >
                  <span className="text-[10px] font-bold text-neutral-600">YT</span>
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
