import { notFound } from 'next/navigation';
import { getMenuBySlug } from '@/lib/api/menus';
import PostWritePage from '@/components/pages/PostWritePage';

export default async function WriteRoute({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu || menu.page_type !== 'board' || menu.board_write_role !== 'user') notFound();
  const title = menu.title?.[lang] || menu.title?.kr || menu.title?.en || '';
  return <PostWritePage menuId={menu.id} menuSlug={slug} menuTitle={title} />;
}
