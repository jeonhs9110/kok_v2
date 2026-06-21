import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import BusinessInfoDisclosure from '@/components/BusinessInfoDisclosure';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const isKr = lang === 'kr';
  const title = isKr ? '개인정보처리방침 · KOKKOK GARDEN' : 'Privacy Policy · KOKKOK GARDEN';
  const desc = isKr
    ? 'KOKKOK GARDEN 개인정보 수집·이용·보관·제3자 제공에 대한 정책 안내.'
    : 'KOKKOK GARDEN privacy policy: data we collect, how we use it, and your rights.';
  return {
    title,
    description: desc,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/privacy`,
      languages: { kr: 'https://www.kokkokgarden.com/kr/privacy', en: 'https://www.kokkokgarden.com/en/privacy' },
    },
    openGraph: { title, description: desc, type: 'article', locale: isKr ? 'ko_KR' : 'en_US', siteName: 'KOKKOK GARDEN' },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!supabase) notFound();

  const { data } = await supabase.from('legal_pages').select('*').eq('slug', 'privacy').eq('is_published', true).single();
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
      <BusinessInfoDisclosure lang={lang} variant="privacy" />
    </div>
  );
}
