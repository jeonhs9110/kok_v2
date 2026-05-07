import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import BoardWriteButton from '@/components/BoardWriteButton';
import { getActiveReviewCards } from '@/lib/api/reviews';
import { getSiteSettings } from '@/lib/api/site-settings';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '');
}
import { getMenuBySlug, getPostsByMenuPaginated } from '@/lib/api/menus';
import { notFound } from 'next/navigation';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 20;

const CONTACT_SLUGS = new Set(['contact', '문의', 'cs', 'support', 'customer-service']);
const REVIEW_SLUGS = new Set([
  'review', 'reviews', 'review-community', 'reviews-community',
  'review_community', 'review-and-community', 'community',
]);

const CONTACT_LABELS: Record<string, {
  home: string; contact: string; subtitle: string;
  hours: string; address: string; phone: string; email: string; overseas: string;
  empty: string;
}> = {
  kr: {
    home: '홈', contact: 'Contact', subtitle: '문의',
    hours: '운영 시간', address: '주소', phone: '대표 번호',
    email: '대표 이메일', overseas: '해외 문의',
    empty: '정보가 아직 등록되지 않았습니다.',
  },
  en: {
    home: 'HOME', contact: 'CONTACT', subtitle: 'Customer Service',
    hours: 'Operating Hours', address: 'Address', phone: 'Phone',
    email: 'Email', overseas: 'Overseas Inquiries',
    empty: 'Contact information has not been configured yet.',
  },
  cn: {
    home: '首页', contact: '联系我们', subtitle: 'Contact',
    hours: '营业时间', address: '地址', phone: '电话',
    email: '邮箱', overseas: '海外咨询',
    empty: '联系信息尚未配置。',
  },
  jp: {
    home: 'ホーム', contact: 'お問い合わせ', subtitle: 'Contact',
    hours: '営業時間', address: '住所', phone: 'お電話',
    email: 'メール', overseas: '海外のお問い合わせ',
    empty: '連絡先情報はまだ登録されていません。',
  },
  vn: {
    home: 'TRANG CHỦ', contact: 'LIÊN HỆ', subtitle: 'Contact',
    hours: 'Giờ làm việc', address: 'Địa chỉ', phone: 'Điện thoại',
    email: 'Email', overseas: 'Yêu cầu nước ngoài',
    empty: 'Thông tin liên hệ chưa được cấu hình.',
  },
  th: {
    home: 'หน้าหลัก', contact: 'ติดต่อเรา', subtitle: 'Contact',
    hours: 'เวลาทำการ', address: 'ที่อยู่', phone: 'โทรศัพท์',
    email: 'อีเมล', overseas: 'สอบถามจากต่างประเทศ',
    empty: 'ยังไม่ได้ตั้งค่าข้อมูลการติดต่อ',
  },
};

async function ContactInfoView({ lang, displayTitle }: { lang: string; displayTitle: string }) {
  const lb = CONTACT_LABELS[lang] ?? CONTACT_LABELS['en'];
  const values = await getSiteSettings([
    'contact_hours', 'contact_address', 'contact_phone',
    'contact_email', 'contact_overseas_email',
  ]);
  const rows: { label: string; value: string; href?: string }[] = [
    { label: lb.hours, value: values.contact_hours },
    { label: lb.address, value: values.contact_address },
    { label: lb.phone, value: values.contact_phone, href: values.contact_phone ? `tel:${values.contact_phone.replace(/\s+/g, '')}` : undefined },
    { label: lb.email, value: values.contact_email, href: values.contact_email ? `mailto:${values.contact_email}` : undefined },
    { label: lb.overseas, value: values.contact_overseas_email, href: values.contact_overseas_email ? `mailto:${values.contact_overseas_email}` : undefined },
  ].filter(r => r.value);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 animate-in fade-in duration-500 bg-white">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-10 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111111]">{lb.contact}</span>
      </div>
      <div className="mb-12 border-b border-neutral-200 pb-8">
        <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-2">{lb.subtitle}</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#111111]">{displayTitle}</h1>
      </div>
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

interface Props {
  slug: string;
  lang: string;
  page?: string;
}

export default async function MenuPage({ slug, lang, page }: Props) {
  const slugLower = slug.toLowerCase();

  // Special case 1: Contact-style menus render the site_settings contact table
  // instead of an empty board/page. Boss requested unifying contact UX here.
  if (CONTACT_SLUGS.has(slugLower)) {
    const menu = await getMenuBySlug(slug);
    const displayTitle = menu?.title?.[lang] || menu?.title?.kr || menu?.title?.en || 'Contact';
    return <ContactInfoView lang={lang} displayTitle={displayTitle} />;
  }

  // Special case 2: Review/community menus surface the curated review_cards
  // showcase (admin-managed) instead of a plain post list.
  if (REVIEW_SLUGS.has(slugLower)) {
    const [menu, cards] = await Promise.all([
      getMenuBySlug(slug),
      getActiveReviewCards(),
    ]);
    const displayTitle = menu?.title?.[lang] || menu?.title?.kr || menu?.title?.en || 'Review & Community';
    const lbEmpty = lang === 'kr' ? '등록된 리뷰가 없습니다.' : 'No reviews yet.';
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
          <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-[#111]">{displayTitle}</span>
        </div>
        {cards.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 text-sm">{lbEmpty}</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 pb-8">
            {cards.map(card => (
              <div
                key={card.id}
                className="relative w-full max-w-[420px] sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1.333rem)] lg:w-[calc(25%-1.5rem)] aspect-square overflow-hidden rounded-lg border border-neutral-100"
              >
                {card.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={card.image_url}
                    alt={card.title || 'review'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-sm">
                    {card.title || 'REVIEW'}
                  </div>
                )}
                {card.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-white text-[13px] font-bold line-clamp-2">{card.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const menu = await getMenuBySlug(slug);
  if (!menu) notFound();

  const title = menu.title?.[lang] || menu.title?.kr || menu.title?.en || '';

  // Page type: render HTML content
  if (menu.page_type === 'page') {
    const content = menu.content?.[lang] || menu.content?.kr || menu.content?.en || '';
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
          <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-[#111]">{title}</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">{title}</h1>
        {content ? (
          <div className="prose prose-neutral max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
        ) : (
          <p className="text-neutral-400 text-sm">콘텐츠가 없습니다.</p>
        )}
      </div>
    );
  }

  // Board type: render post list with pagination
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const { posts, totalCount } = await getPostsByMenuPaginated(menu.id, currentPage, PAGE_SIZE);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canWrite = menu.board_write_role === 'user';

  const lb: Record<string, { empty: string; write: string; author: string; date: string; total: string }> = {
    kr: { empty: '등록된 게시글이 없습니다.', write: '글쓰기', author: '작성자', date: '작성일', total: '총' },
    en: { empty: 'No posts yet.', write: 'Write', author: 'Author', date: 'Date', total: 'Total' },
  };
  const l = lb[lang] ?? lb['en'];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111]">{title}</span>
      </div>

      <div className="flex items-end justify-between mb-8 pb-6 border-b-2 border-[#111]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {totalCount > 0 && (
            <p className="text-xs text-neutral-400 mt-2">{l.total} {totalCount.toLocaleString()}</p>
          )}
        </div>
        <BoardWriteButton
          href={`/${lang}/menus/${slug}/write`}
          label={l.write}
          alwaysShow={canWrite}
        />
      </div>

      {posts.length === 0 ? (
        <div className="py-20 text-center text-neutral-400">
          <p className="text-sm">{l.empty}</p>
        </div>
      ) : (
        <div>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_120px] gap-4 pb-3 text-[11px] font-bold tracking-widest text-neutral-400 uppercase border-b border-neutral-100">
            <span>{lang === 'kr' ? '제목' : 'Title'}</span>
            <span className="text-center">{l.author}</span>
            <span className="text-right">{l.date}</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {posts.map((post, idx) => (
              <Link key={post.id} href={`/${lang}/menus/${slug}/${post.id}`} className="block sm:grid sm:grid-cols-[1fr_120px_120px] sm:gap-4 py-4 hover:bg-neutral-50 transition-colors -mx-2 px-2 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-300 font-mono w-6 hidden sm:inline-block">{totalCount - ((currentPage - 1) * PAGE_SIZE) - idx}</span>
                  <span className="text-[13px] font-semibold text-[#111] line-clamp-1">{post.title}</span>
                  {post.is_admin_post && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#111] text-white rounded">공지</span>}
                </div>
                <span className="text-xs text-neutral-500 text-center hidden sm:block">{post.author_name}</span>
                <span className="text-xs text-neutral-400 text-right hidden sm:block">{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                <div className="sm:hidden flex gap-3 mt-1 text-xs text-neutral-400">
                  <span>{post.author_name}</span>
                  <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={`/${lang}/menus/${slug}`}
          />
        </div>
      )}
    </div>
  );
}
