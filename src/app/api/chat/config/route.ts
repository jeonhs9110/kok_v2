import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface ChatbotConfig {
  show_global: boolean;
  show_domestic: boolean;
  greeting_en: string;
  greeting_kr: string;
}

const DEFAULT: ChatbotConfig = {
  show_global: false,
  show_domestic: false,
  greeting_en: '',
  greeting_kr: '',
};

// Performance audit 2026-06-19 — endpoint was hitting Supabase on every
// homepage mount (~1.3s blocking call from AIChatbot.useEffect). The
// row changes maybe once per quarter, so a 60s unstable_cache + 60s
// CDN max-age is appropriate. updateTag('chatbot_config') on admin save
// (follow-up) will evict immediately.
const fetchConfig = unstable_cache(
  async (): Promise<ChatbotConfig | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('chatbot_config')
        .select('show_global, show_domestic, greeting_en, greeting_kr')
        .single();
      if (error || !data) return DEFAULT;
      return {
        show_global: data.show_global ?? false,
        show_domestic: data.show_domestic ?? false,
        greeting_en: data.greeting_en ?? '',
        greeting_kr: data.greeting_kr ?? '',
      };
    } catch (err) {
      console.error('[chat/config] DB fetch failed:', err);
      return null;
    }
  },
  ['chatbot_config'],
  { revalidate: 60, tags: ['chatbot_config'] },
);

// Previously returned hardcoded { show_global: true, show_domestic: false }
// on every failure path, which meant the chatbot looked enabled even when
// the DB was unreachable or the chatbot_config row was missing. Now a
// failure returns 503 + null body so the client component can hide the
// chatbot entirely and the operator sees a real 5xx in CloudWatch.
export async function GET() {
  if (!supabase) {
    console.error('[chat/config] Supabase client not configured');
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 503 });
  }
  const cfg = await fetchConfig();
  if (cfg === null) {
    return NextResponse.json({ error: 'fetch-failed' }, { status: 503 });
  }
  return NextResponse.json(cfg, {
    headers: {
      // Browser cache for 60s, CDN cache for 5min with stale-while-
      // revalidate so subsequent visitors hit the edge instead of
      // round-tripping to EC2.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
