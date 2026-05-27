import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Reads from `business_info` (managed via /admin/legal) instead of the
// now-removed `site_settings.contact_*` keys. Keeping a single source of
// truth means the Footer (which already reads business_info) and this page
// can never display different phone numbers / addresses.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  cn: {
    title: '联系我们', subtitle: 'Contact',
    home: '首页', contact: '联系我们',
    hours: '营业时间', address: '地址', phone: '电话',
    email: '邮箱', overseas: '海外咨询',
    empty: '联系信息尚未配置。',
  },
  jp: {
    title: 'お問い合わせ', subtitle: 'Contact',
    home: 'ホーム', contact: 'お問い合わせ',
    hours: '営業時間', address: '住所', phone: 'お電話',
    email: 'メール', overseas: '海外のお問い合わせ',
    empty: '連絡先情報はまだ登録されていません。',
  },
  vn: {
    title: 'Liên hệ', subtitle: 'Contact',
    home: 'TRANG CHỦ', contact: 'LIÊN HỆ',
    hours: 'Giờ làm việc', address: 'Địa chỉ', phone: 'Điện thoại',
    email: 'Email', overseas: 'Yêu cầu nước ngoài',
    empty: 'Thông tin liên hệ chưa được cấu hình.',
  },
  th: {
    title: 'ติดต่อเรา', subtitle: 'Contact',
    home: 'หน้าหลัก', contact: 'ติดต่อเรา',
    hours: 'เวลาทำการ', address: 'ที่อยู่', phone: 'โทรศัพท์',
    email: 'อีเมล', overseas: 'สอบถามจากต่างประเทศ',
    empty: 'ยังไม่ได้ตั้งค่าข้อมูลการติดต่อ',
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

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const lb = LABELS[lang] ?? LABELS['en'];

  let biz: BusinessInfoRow | null = null;
  if (supabase) {
    const { data } = await supabase
      .from('business_info')
      .select('phone, email, address_kr, address_en, cs_hours_kr, cs_hours_en, cs_lunch_kr, cs_lunch_en, cs_holiday_kr, cs_holiday_en')
      .maybeSingle();
    biz = (data as BusinessInfoRow | null) ?? null;
  }

  const isKr = lang === 'kr';
  const address = (isKr ? biz?.address_kr : biz?.address_en) || biz?.address_kr || '';
  const hoursParts = isKr
    ? [biz?.cs_hours_kr, biz?.cs_lunch_kr, biz?.cs_holiday_kr]
    : [biz?.cs_hours_en, biz?.cs_lunch_en, biz?.cs_holiday_en];
  const hours = hoursParts.filter(Boolean).join('\n');

  const rows: { label: string; value: string; href?: string }[] = [
    { label: lb.hours,   value: hours },
    { label: lb.address, value: address },
    { label: lb.phone,   value: biz?.phone || '', href: biz?.phone ? `tel:${biz.phone.replace(/\s+/g, '')}` : undefined },
    { label: lb.email,   value: biz?.email || '', href: biz?.email ? `mailto:${biz.email}` : undefined },
  ].filter(r => r.value);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 animate-in fade-in duration-500 bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-10 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111111]">{lb.contact}</span>
      </div>

      {/* Title */}
      <div className="mb-12 border-b border-neutral-200 pb-8">
        <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-2">{lb.subtitle}</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#111111]">{lb.title}</h1>
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
                  <td className="px-4 md:px-6 py-4 md:py-5 text-sm text-[#111111] whitespace-pre-line align-top">
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
