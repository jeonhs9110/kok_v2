import type { Metadata } from 'next';
import ShopWorldwide from '@/components/ShopWorldwide';
import { fetchWorldwideData } from '@/lib/worldwide/fetch';

const META: Record<string, { title: string; description: string }> = {
  kr: {
    title: '글로벌 판매처 · KOKKOK GARDEN',
    description: 'KOKKOK GARDEN을 만날 수 있는 국가별 판매처를 확인하세요. 한국부터 미국, 일본, 중국 등 전 세계로 배송됩니다.',
  },
  en: {
    title: 'Shop Worldwide · KOKKOK GARDEN',
    description: 'Find KOKKOK GARDEN authorized retailers around the world — from Korea to the US, Japan, China, and more.',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const meta = META[lang] ?? META.en;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/worldwide`,
      languages: {
        'ko-KR': 'https://www.kokkokgarden.com/kr/worldwide',
        'en-US': 'https://www.kokkokgarden.com/en/worldwide',
        'x-default': 'https://www.kokkokgarden.com/en/worldwide',
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://www.kokkokgarden.com/${lang}/worldwide`,
      type: 'website',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
    },
  };
}

export default async function WorldwideRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { labels, retailers } = await fetchWorldwideData(lang);
  return <ShopWorldwide lang={lang} labels={labels} retailers={retailers} />;
}
