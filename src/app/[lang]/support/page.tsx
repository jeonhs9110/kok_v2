import type { Metadata } from 'next';
import MenuPage from '@/components/pages/MenuPage';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const isKr = lang === 'kr';
  const title = isKr ? '고객 지원 · KOKKOK GARDEN' : 'Customer Support · KOKKOK GARDEN';
  const desc = isKr
    ? 'KOKKOK GARDEN 고객 지원 — 자주 묻는 질문, 배송 정책, 교환/환불 안내.'
    : 'KOKKOK GARDEN customer support — FAQs, shipping policy, exchanges and refunds.';
  return {
    title,
    description: desc,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/support`,
      languages: {
        'ko-KR': 'https://www.kokkokgarden.com/kr/support',
        'en-US': 'https://www.kokkokgarden.com/en/support',
        'x-default': 'https://www.kokkokgarden.com/en/support',
      },
    },
    openGraph: { title, description: desc, type: 'website', locale: isKr ? 'ko_KR' : 'en_US', siteName: 'KOKKOK GARDEN' },
  };
}

export default async function SupportRoute({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { lang } = await params;
  const { page } = await searchParams;
  return <MenuPage slug="support" lang={lang} page={page} />;
}
