import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import BusinessInfoDisclosure from '@/components/BusinessInfoDisclosure';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function fetchLegal(slug: string): Promise<{ title_kr: string | null; title_en: string | null; content_kr: string | null; content_en: string | null } | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getLegalPageFromPg } = await import('@/lib/db/storefront-reads');
      const row = await getLegalPageFromPg(slug);
      return row ? { title_kr: row.title_kr, title_en: row.title_en, content_kr: row.content_kr, content_en: row.content_en } : null;
    } catch (err) {
      console.error(`[legal/${slug}] pg fetch failed:`, err);
      return null;
    }
  }
  if (!supabase) return null;
  const { data } = await supabase.from('legal_pages').select('*').eq('slug', slug).eq('is_published', true).single();
  return data ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const isKr = lang === 'kr';
  const title = isKr ? '이용약관 · KOKKOK GARDEN' : 'Terms of Service · KOKKOK GARDEN';
  const desc = isKr
    ? 'KOKKOK GARDEN 서비스 이용 약관, 회원의 권리·의무, 청약 철회·환불 규정 안내.'
    : 'KOKKOK GARDEN terms of service: account rights, ordering, returns, and refunds.';
  return {
    title,
    description: desc,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/terms`,
      languages: {
        'ko-KR': 'https://www.kokkokgarden.com/kr/terms',
        'en-US': 'https://www.kokkokgarden.com/en/terms',
        'x-default': 'https://www.kokkokgarden.com/en/terms',
      },
    },
    openGraph: { title, description: desc, type: 'article', locale: isKr ? 'ko_KR' : 'en_US', siteName: 'KOKKOK GARDEN' },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const data = await fetchLegal('terms');
  if (!data) notFound();

  const title = lang === 'kr' ? data.title_kr : data.title_en;
  const content = lang === 'kr' ? data.content_kr : data.content_en;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 bg-white min-h-[60vh]">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{title}</span>
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-brand-ink mb-8">{title}</h1>
      <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">{content}</div>
      <BusinessInfoDisclosure lang={lang} variant="terms" />
    </div>
  );
}
