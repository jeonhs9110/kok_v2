import ShopWorldwide from '@/components/ShopWorldwide';
import { fetchWorldwideData } from '@/lib/worldwide/fetch';

export default async function WorldwideRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { labels, retailers } = await fetchWorldwideData(lang);
  return <ShopWorldwide lang={lang} labels={labels} retailers={retailers} />;
}
