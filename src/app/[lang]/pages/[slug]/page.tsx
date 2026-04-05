import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function CmsPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;

  if (!supabase) notFound();

  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!page) notFound();

  const title = page.title?.[lang] || page.title?.kr || page.title?.en || '';
  const content = page.content?.[lang] || page.content?.kr || page.content?.en || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 bg-white">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111111]">{title}</span>
      </div>

      <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111] mb-8">{title}</h1>

      <div
        className="prose prose-neutral max-w-none prose-headings:font-bold prose-headings:text-[#111111] prose-p:text-neutral-600 prose-a:text-blue-600 prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
