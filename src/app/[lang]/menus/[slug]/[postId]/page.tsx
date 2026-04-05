import PostDetailPage from '@/components/pages/PostDetailPage';

export default async function PostDetailRoute({ params }: { params: Promise<{ lang: string; slug: string; postId: string }> }) {
  const { lang, slug, postId } = await params;
  return <PostDetailPage slug={slug} postId={postId} lang={lang} />;
}
