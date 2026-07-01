import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMenuBySlug, getPostById } from '@/lib/api/menus';
import { pickI18n } from '@/lib/i18n/pickI18n';
import PostWritePage from '@/components/pages/PostWritePage';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === 'kr' ? '글 수정 · KOKKOK GARDEN' : 'Edit Post · KOKKOK GARDEN',
    robots: { index: false, follow: false },
  };
}

export default async function EditPostRoute({ params }: { params: Promise<{ lang: string; slug: string; postId: string }> }) {
  const { lang, slug, postId } = await params;
  const [menu, post] = await Promise.all([getMenuBySlug(slug), getPostById(postId)]);
  if (!menu || !post) notFound();
  const title = pickI18n(menu.title as Record<string, string> | null | undefined, lang);
  return <PostWritePage menuId={menu.id} menuSlug={slug} menuTitle={title} postId={postId} />;
}
