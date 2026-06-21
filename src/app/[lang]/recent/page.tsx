import type { Metadata } from 'next';
import RecentPage from '@/components/pages/RecentPage';

export const metadata: Metadata = {
  title: '최근 본 상품 · KOKKOK GARDEN',
  robots: { index: false, follow: true },
};

export default function RecentRoute() {
  return <RecentPage />;
}
