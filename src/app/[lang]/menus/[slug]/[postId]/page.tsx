import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PostDetailPage from '@/components/pages/PostDetailPage';
import { getPostById, getMenuBySlug } from '@/lib/api/menus';

// UUID guard on [postId] — RDS treats posts.id as a UUID column, so
// a malformed slug like `/kr/menus/notices/junk` would previously
// send `'junk'` to a UUID cast in getPostById and rely on the helper
// swallowing the error. Immediate 404 is cheaper and returns the
// correct HTTP status.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; postId: string }>;
}): Promise<Metadata> {
  const { lang, slug, postId } = await params;
  if (!UUID_RE.test(postId)) {
    return { title: '게시글을 찾을 수 없습니다 · KOKKOK GARDEN', robots: { index: false, follow: true } };
  }
  // Wrap the fetch in try/catch — a throw inside generateMetadata is
  // NOT caught by error.tsx and drops the whole page to Next's
  // default 500 chrome. Fall back to layout defaults on any error
  // so the page body (which reads the same data) can still render.
  let post, menu;
  try {
    [post, menu] = await Promise.all([getPostById(postId), getMenuBySlug(slug)]);
  } catch (err) {
    console.error('[menus/[postId]] generateMetadata fetch threw', err);
    return {};
  }
  if (!post) {
    return { title: '게시글을 찾을 수 없습니다 · KOKKOK GARDEN', robots: { index: false, follow: true } };
  }
  const menuTitle = menu?.title?.[lang] || menu?.title?.kr || menu?.title?.en || slug;
  const title = `${post.title} · ${menuTitle} · KOKKOK GARDEN`;
  const desc = (post.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const url = `https://www.kokkokgarden.com/${lang}/menus/${slug}/${postId}`;
  return {
    title,
    description: desc || post.title,
    alternates: {
      canonical: url,
      languages: {
        kr: `https://www.kokkokgarden.com/kr/menus/${slug}/${postId}`,
        en: `https://www.kokkokgarden.com/en/menus/${slug}/${postId}`,
      },
    },
    openGraph: {
      title: post.title,
      description: desc,
      url,
      type: 'article',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
      authors: post.author_name ? [post.author_name] : undefined,
      // Same KakaoTalk/Naver fallback as menu listings — when posts
      // start carrying a featured_image_url this can prefer that.
      images: [{ url: 'https://www.kokkokgarden.com/kokkokgarden_primary.svg', alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: desc,
      images: ['https://www.kokkokgarden.com/kokkokgarden_primary.svg'],
    },
  };
}

export default async function PostDetailRoute({ params }: { params: Promise<{ lang: string; slug: string; postId: string }> }) {
  const { lang, slug, postId } = await params;
  if (!UUID_RE.test(postId)) notFound();
  return <PostDetailPage slug={slug} postId={postId} lang={lang} />;
}
