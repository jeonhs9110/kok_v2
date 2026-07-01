import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMenuBySlug } from '@/lib/api/menus';
import { pickI18n } from '@/lib/i18n/pickI18n';
import PostWritePage from '@/components/pages/PostWritePage';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === 'kr' ? '글쓰기 · KOKKOK GARDEN' : 'Write · KOKKOK GARDEN',
    robots: { index: false, follow: false },
  };
}

export default async function WriteRoute({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu || menu.page_type !== 'board' || menu.board_write_role !== 'user') notFound();
  const title = pickI18n(menu.title as Record<string, string> | null | undefined, lang);
  return <PostWritePage menuId={menu.id} menuSlug={slug} menuTitle={title} />;
}
