import SubHeroBanner from '@/components/SubHeroBanner';
import { getCachedSubHero } from '@/lib/cache/homepage';

export default async function SubHeroSection() {
  const banner = await getCachedSubHero();
  return <SubHeroBanner banner={banner} />;
}

export function SubHeroSkeleton() {
  return <div className="w-full h-[360px] md:h-[560px] bg-neutral-200 animate-pulse" />;
}
