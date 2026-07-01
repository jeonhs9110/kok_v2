import { Suspense } from 'react';
import type { Metadata } from 'next';
import MyPage from '@/components/pages/MyPage';

export const metadata: Metadata = {
  title: '마이페이지 · KOKKOK GARDEN',
  robots: { index: false, follow: false },
};

export default async function MyPageRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const normalized: 'kr' | 'en' = lang === 'kr' ? 'kr' : 'en';
  // MyPage reads useSearchParams() to pick the active tab from `?tab=`.
  // Next.js 16 requires that hook to sit under a <Suspense> boundary
  // or the whole route bails out of static prerendering and lands on
  // full CSR. Without this wrapper, /kr/mypage renders blank until
  // the JS bundle hydrates on cold loads.
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <MyPage lang={normalized} />
    </Suspense>
  );
}
