import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Reads from `business_info` (managed via /admin/legal) instead of the
// now-removed `site_settings.contact_*` keys. Keeping a single source of
// truth means the Footer (which already reads business_info) and this page
// can never display different phone numbers / addresses.
//
// 2026-06-29: dispatched via USE_RDS. Previously hit Supabase
// unconditionally — after the 2026-06-27 decommission, the page silently
// rendered the empty-state ("정보가 아직 등록되지 않았습니다") to every
// visitor instead of the operator's actual CS hours / phone / email /
// address. CS-blocking customer-facing bug.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function fetchBusinessInfo(): Promise<BusinessInfoRow | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getBusinessInfoFromPg } = await import('@/lib/db/storefront-reads');
      const row = await getBusinessInfoFromPg();
      if (!row) return null;
      return {
        phone: row.phone ?? null,
        email: row.email ?? null,
        address_kr: row.address_kr ?? null,
        address_en: row.address_en ?? null,
        cs_hours_kr: row.cs_hours_kr ?? null,
        cs_hours_en: row.cs_hours_en ?? null,
        cs_lunch_kr: row.cs_lunch_kr ?? null,
        cs_lunch_en: row.cs_lunch_en ?? null,
        cs_holiday_kr: row.cs_holiday_kr ?? null,
        cs_holiday_en: row.cs_holiday_en ?? null,
      };
    } catch (err) {
      console.error('[contact] business_info RDS read failed:', err);
      return null;
    }
  }
  if (!supabase) return null;
  const { data } = await supabase
    .from('business_info')
    .select('phone, email, address_kr, address_en, cs_hours_kr, cs_hours_en, cs_lunch_kr, cs_lunch_en, cs_holiday_kr, cs_holiday_en')
    .maybeSingle();
  return (data as BusinessInfoRow | null) ?? null;
}

// isValidLang gates the [lang] segment to 'kr' | 'en' at the layout,
// so cn/jp/vn/th used to be dead entries here. Removed 2026-07-01
// during Round 16 SEO audit — never rendered.
const LABELS: Record<string, {
  title: string; subtitle: string; home: string; contact: string;
  hours: string; address: string; phone: string; email: string; overseas: string;
  empty: string;
}> = {
  kr: {
    title: 'Contact', subtitle: '문의',
    home: '홈', contact: 'Contact',
    hours: '운영 시간', address: '주소', phone: '대표 번호',
    email: '대표 이메일', overseas: '해외 문의',
    empty: '정보가 아직 등록되지 않았습니다.',
  },
  en: {
    title: 'Contact', subtitle: 'Customer Service',
    home: 'HOME', contact: 'CONTACT',
    hours: 'Operating Hours', address: 'Address', phone: 'Phone',
    email: 'Email', overseas: 'Overseas Inquiries',
    empty: 'Contact information has not been configured yet.',
  },
};

interface BusinessInfoRow {
  phone: string | null;
  email: string | null;
  address_kr: string | null;
  address_en: string | null;
  cs_hours_kr: string | null;
  cs_hours_en: string | null;
  cs_lunch_kr: string | null;
  cs_lunch_en: string | null;
  cs_holiday_kr: string | null;
  cs_holiday_en: string | null;
}

const META: Record<string, { title: string; description: string }> = {
  kr: { title: '문의 · KOKKOK GARDEN', description: 'KOKKOK GARDEN 고객센터 운영시간, 대표 번호, 이메일, 주소 안내.' },
  en: { title: 'Contact · KOKKOK GARDEN', description: 'KOKKOK GARDEN customer service hours, phone, email, and address.' },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const meta = META[lang] ?? META.en;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/contact`,
      languages: {
        kr: 'https://www.kokkokgarden.com/kr/contact',
        en: 'https://www.kokkokgarden.com/en/contact',
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://www.kokkokgarden.com/${lang}/contact`,
      type: 'website',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const lb = LABELS[lang] ?? LABELS['en'];

  const biz = await fetchBusinessInfo();

  const isKr = lang === 'kr';
  const address = (isKr ? biz?.address_kr : biz?.address_en) || biz?.address_kr || '';
  const hoursParts = isKr
    ? [biz?.cs_hours_kr, biz?.cs_lunch_kr, biz?.cs_holiday_kr]
    : [biz?.cs_hours_en, biz?.cs_lunch_en, biz?.cs_holiday_en];
  const hours = hoursParts.filter(Boolean).join('\n');

  const rows: { label: string; value: string; href?: string }[] = [
    { label: lb.hours,   value: hours },
    { label: lb.address, value: address },
    // Round 28: strip anything non-digit (and keep the leading +) from
    // the tel: URI so Naver Whale on iOS still dials — its parser
    // refuses tel: URIs containing parentheses. Display value keeps the
    // operator's formatting intact.
    { label: lb.phone,   value: biz?.phone || '', href: biz?.phone ? `tel:${biz.phone.replace(/[^\d+]/g, '')}` : undefined },
    { label: lb.email,   value: biz?.email || '', href: biz?.email ? `mailto:${biz.email}` : undefined },
  ].filter(r => r.value);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 animate-in fade-in duration-500 bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-10 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{lb.contact}</span>
      </div>

      {/* Title */}
      <div className="mb-12 border-b border-neutral-200 pb-8">
        <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-2">{lb.subtitle}</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-brand-ink">{lb.title}</h1>
      </div>

      {/* Info table */}
      {rows.length === 0 ? (
        <div className="text-center py-24 text-neutral-400 text-sm">{lb.empty}</div>
      ) : (
        <div className="border border-neutral-200">
          <table className="w-full">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i !== rows.length - 1 ? 'border-b border-neutral-200' : ''}>
                  <th
                    scope="row"
                    className="text-[11px] font-bold tracking-widest text-neutral-500 uppercase text-left px-4 md:px-6 py-4 md:py-5 bg-neutral-50 w-36 md:w-52 align-top"
                  >
                    {r.label}
                  </th>
                  <td className="px-4 md:px-6 py-4 md:py-5 text-sm text-brand-ink whitespace-pre-line align-top">
                    {r.href ? (
                      <a href={r.href} className="hover:underline underline-offset-4 break-all">{r.value}</a>
                    ) : (
                      r.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
