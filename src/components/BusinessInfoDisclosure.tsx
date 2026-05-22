import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface BizInfo {
  company_name_kr: string;
  company_name_en: string;
  ceo_name: string;
  business_reg_number: string;
  mail_order_number: string;
  address_kr: string;
  address_en: string;
  phone: string;
  email: string;
  privacy_officer_name: string;
  privacy_officer_email: string;
}

interface Props {
  lang: string;
  /** 'privacy' adds the privacy-officer line at the bottom. */
  variant?: 'terms' | 'privacy';
}

/**
 * Structured business-info disclosure rendered below legal pages.
 * Pulls live values from public.business_info so the admin only has to
 * maintain one source of truth in /admin/legal → 사업자정보. Required by
 * 전자상거래법 (terms) and 개인정보보호법 (privacy).
 */
export default async function BusinessInfoDisclosure({ lang, variant = 'terms' }: Props) {
  if (!supabase) return null;
  const { data } = await supabase.from('business_info').select('*').maybeSingle();
  if (!data) return null;

  const biz = data as BizInfo;
  const isKr = lang === 'kr';
  const companyName = isKr ? biz.company_name_kr : (biz.company_name_en || biz.company_name_kr);
  const address     = isKr ? biz.address_kr     : (biz.address_en     || biz.address_kr);

  const L = isKr
    ? {
        title: '사업자 정보',
        company: '상호',
        ceo: '대표자',
        bizNum: '사업자등록번호',
        mailOrder: '통신판매업신고번호',
        address: '주소',
        phone: '전화',
        email: '이메일',
        privacyOfficerTitle: '개인정보 보호책임자',
      }
    : {
        title: 'Business Information',
        company: 'Company',
        ceo: 'CEO',
        bizNum: 'Business Reg. No.',
        mailOrder: 'Mail-Order Reg.',
        address: 'Address',
        phone: 'Tel',
        email: 'Email',
        privacyOfficerTitle: 'Privacy Officer',
      };

  const showPrivacyBlock =
    variant === 'privacy' && (biz.privacy_officer_name || biz.privacy_officer_email);

  return (
    <section className="mt-12 pt-8 border-t border-neutral-200">
      <h2 className="text-base font-bold text-[#111] mb-4">{L.title}</h2>
      <dl className="text-sm text-neutral-600 grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 leading-relaxed">
        {companyName && (<><dt className="font-semibold text-neutral-700">{L.company}</dt><dd>{companyName}</dd></>)}
        {biz.ceo_name && (<><dt className="font-semibold text-neutral-700">{L.ceo}</dt><dd>{biz.ceo_name}</dd></>)}
        {biz.business_reg_number && (<><dt className="font-semibold text-neutral-700">{L.bizNum}</dt><dd>{biz.business_reg_number}</dd></>)}
        {biz.mail_order_number && (<><dt className="font-semibold text-neutral-700">{L.mailOrder}</dt><dd>{biz.mail_order_number}</dd></>)}
        {address && (<><dt className="font-semibold text-neutral-700">{L.address}</dt><dd>{address}</dd></>)}
        {biz.phone && (<><dt className="font-semibold text-neutral-700">{L.phone}</dt><dd>{biz.phone}</dd></>)}
        {biz.email && (<><dt className="font-semibold text-neutral-700">{L.email}</dt><dd>{biz.email}</dd></>)}
      </dl>

      {showPrivacyBlock && (
        <div className="mt-6 pt-6 border-t border-neutral-100">
          <h3 className="text-sm font-bold text-[#111] mb-2">{L.privacyOfficerTitle}</h3>
          <p className="text-sm text-neutral-600">
            {biz.privacy_officer_name}
            {biz.privacy_officer_email && ` · ${biz.privacy_officer_email}`}
          </p>
        </div>
      )}
    </section>
  );
}
