import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import PageBlocks from '@/components/PageBlocks';
import type { PageBlock } from '@/lib/pages/blocks';

interface CmsPageRow {
  title: unknown;
  content: unknown;
  blocks?: unknown;
}

// 2026-06-29: dispatched via USE_RDS. Pre-fix this page hit Supabase
// unconditionally — after the 2026-06-27 decommission, every admin-built
// CMS page (operator's "About", "FAQ", custom landing pages, etc.) was
// 404-ing for every customer. Big surface-area break that the operator
// likely didn't notice because the routes silently notFound() instead
// of erroring.
async function fetchCmsPage(slug: string, full: boolean): Promise<CmsPageRow | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const cols = full ? '*' : 'title, content';
      const { rows } = await pool.query<CmsPageRow>(
        `SELECT ${cols} FROM public.pages WHERE slug = $1 AND is_published = true LIMIT 1`,
        [slug],
      );
      return rows[0] ?? null;
    } catch (err) {
      console.error(`[cms-page/${slug}] RDS read failed:`, err);
      return null;
    }
  }
  if (!supabase) return null;
  const { data } = await supabase
    .from('pages')
    .select(full ? '*' : 'title, content')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();
  return (data as CmsPageRow | null) ?? null;
}

function pickLangString(map: unknown, lang: string): string {
  if (!map || typeof map !== 'object') return '';
  const m = map as Record<string, unknown>;
  const v = m[lang] ?? m.kr ?? m.en;
  return typeof v === 'string' ? v : '';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = await fetchCmsPage(slug, false);
  if (!page) {
    return { title: '페이지를 찾을 수 없습니다 · KOKKOK GARDEN', robots: { index: false, follow: true } };
  }
  const titleText = pickLangString(page.title, lang) || slug;
  const contentText = pickLangString(page.content, lang);
  const desc = contentText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const url = `https://www.kokkokgarden.com/${lang}/pages/${slug}`;
  return {
    title: `${titleText} · KOKKOK GARDEN`,
    description: desc || titleText,
    alternates: {
      canonical: url,
      languages: {
        kr: `https://www.kokkokgarden.com/kr/pages/${slug}`,
        en: `https://www.kokkokgarden.com/en/pages/${slug}`,
      },
    },
    openGraph: {
      title: `${titleText} · KOKKOK GARDEN`,
      description: desc,
      url,
      type: 'article',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
    },
  };
}

// Strip script tags and event handlers from HTML content
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function pickBlocks(
  blocks: unknown,
  lang: string,
): PageBlock[] | null {
  if (!blocks || typeof blocks !== 'object') return null;
  const byLang = blocks as Record<string, unknown>;
  const candidate =
    (Array.isArray(byLang[lang]) && byLang[lang]) ||
    (Array.isArray(byLang.kr) && byLang.kr) ||
    (Array.isArray(byLang.en) && byLang.en);
  return Array.isArray(candidate) ? (candidate as PageBlock[]) : null;
}

export default async function CmsPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const page = await fetchCmsPage(slug, true);
  if (!page) notFound();

  const titleMap = (page.title ?? {}) as Record<string, string>;
  const contentMap = (page.content ?? {}) as Record<string, string>;
  const title = titleMap[lang] || titleMap.kr || titleMap.en || '';
  const blocks = pickBlocks(page.blocks, lang);
  // Fallback to the legacy rich-text content when no blocks are saved
  // (pages built before the page-builder migrate over lazily).
  const content = contentMap[lang] || contentMap.kr || contentMap.en || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 bg-white">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{title}</span>
      </div>

      <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-brand-ink mb-8">{title}</h1>

      {blocks && blocks.length > 0 ? (
        <PageBlocks blocks={blocks} />
      ) : (
        <div
          className="prose prose-neutral max-w-none prose-headings:font-bold prose-headings:text-brand-ink prose-p:text-neutral-600 prose-a:text-blue-600 prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      )}
    </div>
  );
}
