import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getSiteSettings } from '@/lib/api/site-settings';

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

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const lb = LABELS[lang] ?? LABELS['en'];

  const values = await getSiteSettings([
    'contact_hours',
    'contact_address',
    'contact_phone',
    'contact_email',
    'contact_overseas_email',
  ]);

  const rows: { label: string; value: string; href?: string }[] = [
    { label: lb.hours,    value: values.contact_hours },
    { label: lb.address,  value: values.contact_address },
    { label: lb.phone,    value: values.contact_phone, href: values.contact_phone ? `tel:${values.contact_phone.replace(/\s+/g, '')}` : undefined },
    { label: lb.email,    value: values.contact_email, href: values.contact_email ? `mailto:${values.contact_email}` : undefined },
    { label: lb.overseas, value: values.contact_overseas_email, href: values.contact_overseas_email ? `mailto:${values.contact_overseas_email}` : undefined },
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
