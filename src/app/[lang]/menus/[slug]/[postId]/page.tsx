import type { Metadata } from 'next';
import PostDetailPage from '@/components/pages/PostDetailPage';
import { getPostById, getMenuBySlug } from '@/lib/api/menus';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; postId: string }>;
}): Promise<Metadata> {
  const { lang, slug, postId } = await params;
  const [post, menu] = await Promise.all([getPostById(postId), getMenuBySlug(slug)]);
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
    },
  };
}

export default async function PostDetailRoute({ params }: { params: Promise<{ lang: string; slug: string; postId: string }> }) {
  const { lang, slug, postId } = await params;
  return <PostDetailPage slug={slug} postId={postId} lang={lang} />;
}
