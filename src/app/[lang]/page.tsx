import { headers } from 'next/headers';
import HeroSlider from '@/components/HeroSlider';
import ProductGrid from '@/components/ProductGrid';
import ShortsFeed from '@/components/ShortsFeed';
import { createClient } from '@supabase/supabase-js';
import { getProducts } from '@/lib/api/products';
import { getActiveSlides } from '@/lib/api/carousel';
import type { Lang } from '@/lib/i18n/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const FALLBACK_YT_IDS = ['ho0EhuO3RNs', 'lD1VId0ec2s', 'mkBTUDxMKtU', 'yPRcriD4FcM'];

const SECTION_TITLES: Record<string, { weeklyBest: string; newArrivals: string }> = {
  kr: { weeklyBest: '이번주 베스트', newArrivals: '신상품' },
  en: { weeklyBest: 'WEEKLY BEST', newArrivals: 'NEW ARRIVALS' },
};

const GLOBAL_BANNER: Record<string, string> = {
  kr: '글로벌 스토어입니다 — 주문은 한국 스토어를 이용해주세요',
  en: 'Global store — Products are available for purchase in South Korea only',
};

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  const isKorea = country === 'KR';

  const titles = SECTION_TITLES[lang] ?? SECTION_TITLES['en'];
  const banner = GLOBAL_BANNER[lang] ?? GLOBAL_BANNER['en'];

  const [allProducts, carouselSlides] = await Promise.all([getProducts(), getActiveSlides()]);
  const activeProducts = allProducts.filter(p => p.is_active);

  const calculateDiscount = (price: number, original: number) =>
    original > price ? Math.round(((original - price) / original) * 100) : 0;

  const formattedProducts = activeProducts.map(p => ({
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  }));

  const half = Math.ceil(formattedProducts.length / 2);
  const bestProducts = formattedProducts.slice(0, Math.max(half, 4));
  const newProducts = [...formattedProducts].reverse().slice(0, Math.max(half, 4));

  let liveShorts: string[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase.from('shorts').select('youtube_id').order('created_at', { ascending: false }).limit(10);
      if (!error && data && data.length > 0) {
        liveShorts = data.map(d => `https://www.youtube.com/embed/${d.youtube_id}`);
      }
    }
  } catch { /* use fallback */ }

  const finalShorts = liveShorts.length > 0
    ? liveShorts
    : FALLBACK_YT_IDS.map(id => `https://www.youtube.com/embed/${id}`);

  return (
    <div className="animate-in fade-in duration-700">
      {!isKorea && (
        <div className="bg-gradient-to-r from-[#4a7ab5] to-[#6b9fd4] text-white text-center py-2 px-4 text-[13px] font-medium">
          🌏 {banner}
        </div>
      )}
      <HeroSlider lang={lang as Lang} slides={carouselSlides} />
      <ProductGrid title={titles.weeklyBest} products={bestProducts} canPurchase={isKorea} />
      <ProductGrid title={titles.newArrivals} products={newProducts} canPurchase={isKorea} />
      <ShortsFeed shorts={finalShorts} />
    </div>
  );
}
