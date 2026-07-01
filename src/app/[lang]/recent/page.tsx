import type { Metadata } from 'next';
import RecentPage from '@/components/pages/RecentPage';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === 'kr' ? '최근 본 상품 · KOKKOK GARDEN' : 'Recently Viewed · KOKKOK GARDEN',
    robots: { index: false, follow: true },
  };
}

export default function RecentRoute() {
  return <RecentPage />;
}
