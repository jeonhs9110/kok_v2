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
//
// 2026-06-29: added USE_RDS dispatcher. Pre-fix this read hit Supabase
// unconditionally, so every chatbot config edit landing in RDS post-
// cutover was invisible to the storefront. The chatbot's show_global /
// show_domestic toggles AND the greeting text have been frozen at the
// 2026-06-27 snapshot for 3 days. Worse, if the cached row's toggles
// were false at cutover, the chatbot has been invisible on the
// storefront regardless of what the operator has tried to flip in
// admin.
const fetchConfig = unstable_cache(
  async (): Promise<ChatbotConfig | null> => {
    if (process.env.USE_RDS === 'true') {
      try {
        const { getPgPool } = await import('@/lib/db/pool');
        const pool = getPgPool();
        const { rows } = await pool.query<{
          show_global: boolean | null;
          show_domestic: boolean | null;
          greeting_en: string | null;
          greeting_kr: string | null;
        }>(
          `SELECT show_global, show_domestic, greeting_en, greeting_kr
             FROM public.chatbot_config
             LIMIT 1`,
        );
        const row = rows[0];
        if (!row) return DEFAULT;
        return {
          show_global: row.show_global ?? false,
          show_domestic: row.show_domestic ?? false,
          greeting_en: row.greeting_en ?? '',
          greeting_kr: row.greeting_kr ?? '',
        };
      } catch (err) {
        console.error('[chat/config] RDS fetch failed:', err);
        return null;
      }
    }
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
  // Allow the RDS path through even when the Supabase client isn't
  // configured — under USE_RDS=true the legacy supabase var is unused.
  if (process.env.USE_RDS !== 'true' && !supabase) {
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
