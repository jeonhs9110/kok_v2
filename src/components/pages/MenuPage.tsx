import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import BoardWriteButton from '@/components/BoardWriteButton';
import { getActiveReviewCards } from '@/lib/api/reviews';
import { createClient } from '@supabase/supabase-js';

// Contact rendering reads from `business_info` (Footer's source) instead of
// the legacy `site_settings.contact_*` keys, so all contact surfaces on the
// site display the same number / email / address.
//
// 2026-06-29: dispatched via USE_RDS. The `_supabase` underscore prefix
// was meant to flag the legacy path, but ContactInfoView was still
// calling _getBizContact() on every CONTACT_SLUGS menu hit — so any
// menu mapped to one of CONTACT_SLUGS (contact, 문의, cs, support,
// customer-service) was rendering frozen 2026-06-27 contact data
// instead of whatever the operator has edited since.
const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const _supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const _supabase = _supabaseUrl && _supabaseKey ? createClient(_supabaseUrl, _supabaseKey) : null;

interface BizContact {
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

async function _getBizContact(): Promise<BizContact | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getBusinessInfoFromPg } = await import('@/lib/db/storefront-reads');
      const row = await getBusinessInfoFromPg();
      if (!row) return null;
      const r = row as unknown as Record<string, string | null>;
      return {
        phone: r.phone ?? null,
        email: r.email ?? null,
        address_kr: r.address_kr ?? null,
        address_en: r.address_en ?? null,
        cs_hours_kr: r.cs_hours_kr ?? null,
        cs_hours_en: r.cs_hours_en ?? null,
        cs_lunch_kr: r.cs_lunch_kr ?? null,
        cs_lunch_en: r.cs_lunch_en ?? null,
        cs_holiday_kr: r.cs_holiday_kr ?? null,
        cs_holiday_en: r.cs_holiday_en ?? null,
      };
    } catch (err) {
      console.error('[MenuPage] business_info RDS read failed:', err);
      return null;
    }
  }
  if (!_supabase) return null;
  const { data } = await _supabase
    .from('business_info')
    .select('phone, email, address_kr, address_en, cs_hours_kr, cs_hours_en, cs_lunch_kr, cs_lunch_en, cs_holiday_kr, cs_holiday_en')
    .maybeSingle();
  return (data as BizContact | null) ?? null;
}

// Hosts the RichEditor's "embed" button produces iframes for, plus the
// embed origins their players load (e.g. youtube-nocookie). Anything not
// in this list gets stripped — the previous blanket strip killed the
// editor's own legitimate output.
const IFRAME_ALLOWED_HOST_RE = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)(?:\/|$)/i;

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Allow <iframe> only if its src points at a whitelisted embed host
    // (YouTube / Vimeo). Strip everything else, including <iframe>s with
    // no src or odd schemes. The closing </iframe> tag we leave alone —
    // RichEditor emits well-formed pairs and a stray </iframe> in text
    // would have rendered as harmless plain text already.
    .replace(/<iframe\b([^>]*)>/gi, (match, attrs) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
      const src = srcMatch ? (srcMatch[2] ?? srcMatch[3] ?? '') : '';
      return IFRAME_ALLOWED_HOST_RE.test(src) ? match : '';
    })
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
  const biz = await _getBizContact();
  const isKr = lang === 'kr';
  const address = (isKr ? biz?.address_kr : biz?.address_en) || biz?.address_kr || '';
  const hours = [
    isKr ? biz?.cs_hours_kr   : biz?.cs_hours_en,
    isKr ? biz?.cs_lunch_kr   : biz?.cs_lunch_en,
    isKr ? biz?.cs_holiday_kr : biz?.cs_holiday_en,
  ].filter(Boolean).join('\n');
  const rows: { label: string; value: string; href?: string }[] = [
    { label: lb.hours,   value: hours },
    { label: lb.address, value: address },
    { label: lb.phone,   value: biz?.phone || '', href: biz?.phone ? `tel:${biz.phone.replace(/\s+/g, '')}` : undefined },
    { label: lb.email,   value: biz?.email || '', href: biz?.email ? `mailto:${biz.email}` : undefined },
  ].filter(r => r.value);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 animate-in fade-in duration-500 bg-white">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-10 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{lb.contact}</span>
      </div>
      <div className="mb-12 border-b border-neutral-200 pb-8">
        <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-2">{lb.subtitle}</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-brand-ink">{displayTitle}</h1>
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
  //
  // Count-driven layout (decided at the 2026-06-10 boss meeting):
  //   - 0 cards → empty-state copy
  //   - 1 card  → render its full body inline (no thumbnail-click step;
  //               clicking is pointless with a single card)
  //   - >1 cards → thumbnail grid; customer clicks a card to open the body
  if (REVIEW_SLUGS.has(slugLower)) {
    const [menu, cards] = await Promise.all([
      getMenuBySlug(slug),
      getActiveReviewCards(),
    ]);
    const displayTitle = menu?.title?.[lang] || menu?.title?.kr || menu?.title?.en || 'Review & Community';
    const lbEmpty = lang === 'kr' ? '등록된 리뷰가 없습니다.' : 'No reviews yet.';

    if (cards.length === 1) {
      const only = cards[0];
      return (
        <div className="bg-white animate-in fade-in duration-500">
          {only.image_url && (
            <div className="w-full bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={only.image_url}
                alt={only.title}
                className="w-full max-h-[60vh] object-cover"
              />
            </div>
          )}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
            <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest flex-wrap gap-y-1">
              <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
              <ChevronRight className="w-3 h-3 mx-2" />
              <span className="text-brand-ink">{displayTitle}</span>
            </div>
            {only.title && (
              <div className="mb-10 pb-8 border-b border-neutral-200">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-brand-ink leading-tight">
                  {only.title}
                </h1>
              </div>
            )}
            {only.content_html ? (
              <div
                className="detail-body"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(only.content_html) }}
              />
            ) : (
              <p className="text-neutral-400 text-sm">{lbEmpty}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
          <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-brand-ink">{displayTitle}</span>
        </div>
        {cards.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 text-sm">{lbEmpty}</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 pb-8">
            {cards.map(card => (
              <Link
                key={card.id}
                href={`/${lang}/reviews/${card.id}`}
                className="group relative w-full max-w-[420px] sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1.333rem)] lg:w-[calc(25%-1.5rem)] aspect-square overflow-hidden rounded-lg border border-neutral-100 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                {card.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={card.image_url}
                    alt={card.title || 'review'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-sm">
                    {card.title || 'REVIEW'}
                  </div>
                )}
                {card.title && (
                  <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                    <p className="text-white text-[13px] font-bold line-clamp-2 drop-shadow-md">{card.title}</p>
                  </div>
                )}
              </Link>
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
          <span className="text-brand-ink">{title}</span>
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
        <span className="text-brand-ink">{title}</span>
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
                  <span className="text-[13px] font-semibold text-brand-ink line-clamp-1">{post.title}</span>
                  {post.is_admin_post && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-ink text-white rounded">공지</span>}
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
