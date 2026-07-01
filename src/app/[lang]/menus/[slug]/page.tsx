import type { Metadata } from 'next';
import MenuPage from '@/components/pages/MenuPage';
import { getMenuBySlug } from '@/lib/api/menus';

function pickLang(map: Record<string, string> | string | null | undefined, lang: string, fallback: string): string {
  if (!map) return fallback;
  if (typeof map === 'string') return map;
  return map[lang] || map.kr || map.en || Object.values(map).find(v => v && v.trim()) || fallback;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  // getMenuBySlug already filters on is_published — null = not found OR
  // unpublished, both of which should render the 404 metadata.
  const menu = await getMenuBySlug(slug);
  if (!menu) {
    return {
      title: lang === 'kr' ? '페이지를 찾을 수 없습니다 · KOKKOK GARDEN' : 'Page Not Found · KOKKOK GARDEN',
      robots: { index: false, follow: true },
    };
  }
  // /[lang]/support is the canonical URL for the support content — the
  // same slug also renders under /[lang]/menus/support because every
  // published menu lives at that route. Noindex the /menus/support
  // variant so Google doesn't split ranking between two URLs with
  // identical HTML.
  const isAliasedElsewhere = slug === 'support';
  const title = `${pickLang(menu.title, lang, slug)} · KOKKOK GARDEN`;
  // content is HTML; strip tags + clamp to 160 chars for description.
  const raw = pickLang(menu.content, lang, '');
  const desc = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const url = `https://www.kokkokgarden.com/${lang}/menus/${slug}`;
  // Round 30: extract first `<img>` from the menu body — same pattern
  // as pages/[slug]. Falls back to the brand SVG only when the menu
  // has no image content (Kakao's SVG rejection means these menus
  // get text-only cards until a dedicated 1200x630 png ships).
  const firstImg = raw.match(/<img[^>]+src=(?:"([^"]+)"|'([^']+)')/i);
  const ogImage = (firstImg?.[1] ?? firstImg?.[2]) || 'https://www.kokkokgarden.com/kokkokgarden_primary.svg';
  return {
    title,
    description: desc || `${pickLang(menu.title, lang, slug)} — KOKKOK GARDEN`,
    robots: isAliasedElsewhere ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: url,
      languages: {
        'ko-KR': `https://www.kokkokgarden.com/kr/menus/${slug}`,
        'en-US': `https://www.kokkokgarden.com/en/menus/${slug}`,
        'x-default': `https://www.kokkokgarden.com/en/menus/${slug}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url,
      type: 'article',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
      images: [{ url: ogImage, alt: pickLang(menu.title, lang, slug) }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function MenuRoute({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { lang, slug } = await params;
  const { page } = await searchParams;
  return <MenuPage slug={slug} lang={lang} page={page} />;
}
