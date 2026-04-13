import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

// Parse <item><link>...</link></item> from RSS XML
function parseRssItems(xml: string): string[] {
  const urls: string[] = [];
  // Match all <item>...</item> blocks
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];
    // Prefer <link>, fall back to <guid>
    const linkMatch = itemXml.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const guidMatch = itemXml.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/i);
    const raw = (linkMatch?.[1] || guidMatch?.[1] || '').trim();
    // Strip CDATA wrapper if present
    const url = raw.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
    if (url && extractPostId(url)) {
      urls.push(url);
    }
  }
  return urls;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
    }

    // Get RSS feed URL from config
    const { data: config } = await supabase
      .from('instagram_config')
      .select('rss_feed_url, handle')
      .single();

    const rssUrl = config?.rss_feed_url?.trim();
    if (!rssUrl) {
      return NextResponse.json(
        { error: 'RSS feed URL이 설정되지 않았습니다. 먼저 설정 저장 후 다시 시도하세요.' },
        { status: 400 }
      );
    }

    // Fetch RSS
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 KokKokGardenRefresh/1.0' },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `RSS 피드 가져오기 실패: ${res.status}` },
        { status: 502 }
      );
    }
    const xml = await res.text();

    // Parse URLs
    const allUrls = parseRssItems(xml);
    if (allUrls.length === 0) {
      return NextResponse.json(
        { error: 'RSS 피드에서 Instagram 포스트를 찾을 수 없습니다. URL이 올바른지 확인해주세요.' },
        { status: 404 }
      );
    }

    const newUrls = allUrls.slice(0, 6);

    // Compare with existing
    const { data: existing } = await supabase
      .from('instagram_posts')
      .select('post_url')
      .order('sort_order')
      .limit(6);

    const existingIds = new Set<string>(
      (existing || [])
        .map(p => (p.post_url ? extractPostId(p.post_url) : null))
        .filter((id): id is string => !!id)
    );
    const newIds = newUrls.map(u => extractPostId(u)).filter((id): id is string => !!id);

    const added = newIds.filter(id => !existingIds.has(id));
    const removed = [...existingIds].filter(id => !newIds.includes(id));
    const unchanged = newIds.filter(id => existingIds.has(id));

    return NextResponse.json({
      urls: newUrls,
      stats: {
        total: newIds.length,
        added: added.length,
        removed: removed.length,
        unchanged: unchanged.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `새로고침 실패: ${msg}` }, { status: 500 });
  }
}
