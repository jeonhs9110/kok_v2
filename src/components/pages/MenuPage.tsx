import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getMenuBySlug, getPostsByMenuPaginated } from '@/lib/api/menus';
import { notFound } from 'next/navigation';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 20;

interface Props {
  slug: string;
  lang: string;
  page?: string;
}

export default async function MenuPage({ slug, lang, page }: Props) {
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
          <div className="prose prose-neutral max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
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
        {canWrite && (
          <Link href={`/${lang}/menus/${slug}/write`} className="px-5 py-2.5 bg-[#111] text-white text-[13px] font-bold tracking-wider hover:bg-black transition-colors">
            {l.write}
          </Link>
        )}
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
