import type { Metadata } from 'next';
import MyPage from '@/components/pages/MyPage';

export const metadata: Metadata = {
  title: '마이페이지 · KOKKOK GARDEN',
  robots: { index: false, follow: false },
};

export default async function MyPageRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const normalized: 'kr' | 'en' = lang === 'kr' ? 'kr' : 'en';
  return <MyPage lang={normalized} />;
}
