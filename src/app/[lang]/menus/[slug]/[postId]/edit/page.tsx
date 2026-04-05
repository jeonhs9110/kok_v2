import { notFound } from 'next/navigation';
import { getMenuBySlug, getPostById } from '@/lib/api/menus';
import PostWritePage from '@/components/pages/PostWritePage';

export default async function EditPostRoute({ params }: { params: Promise<{ lang: string; slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const [menu, post] = await Promise.all([getMenuBySlug(slug), getPostById(postId)]);
  if (!menu || !post) notFound();
  const title = menu.title?.kr || menu.title?.en || '';
  return <PostWritePage menuId={menu.id} menuSlug={slug} menuTitle={title} postId={postId} />;
}
