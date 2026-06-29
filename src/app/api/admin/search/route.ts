import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const LANGS = ['kr', 'en', 'jp', 'cn', 'vn', 'th'] as const;
const PER_TABLE_LIMIT = 8;

/**
 * GET /api/admin/search?q=<query>
 *
 * Admin Cmd/Ctrl+K global search across products + menus + pages +
 * posts. The result shape matches the one the `useAdminSearch` hook
 * used to build directly from Supabase — this route replaces that
 * client-side Supabase query so the hook works post-decommission.
 *
 * Query is sanitized server-side (strip everything but unicode
 * letters / numbers / whitespace) before going into the ILIKE pattern
 * so a curious operator's "what if I type ';--" doesn't probe SQL.
 * pg's parameterized $-arg already protects against SQL injection,
 * but stripping the noise also stops the query from matching nothing
 * just because the user pasted a stray semicolon.
 *
 * 2026-06-29: created as part of the Supabase-only sweep. The hook
 * had no USE_RDS dispatcher; after the 2026-06-27 decommission every
 * Cmd+K opened a search that returned zero results (operator's
 * "quick jump" feature silently broken).
 */
interface SearchHit {
  kind: 'product' | 'menu' | 'page' | 'post';
  id: string;
  label: string;
  href: string;
}

function pickLabel(map: unknown, fallback: string): string {
  if (!map) return fallback;
  if (typeof map === 'string') return map;
  if (typeof map === 'object') {
    const m = map as Record<string, unknown>;
    for (const k of LANGS) {
      const v = m[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return fallback;
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  // Strip everything but Unicode letters / numbers / whitespace.
  const safeQ = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!safeQ) {
    return NextResponse.json({ results: [] });
  }
  const pattern = `%${safeQ}%`;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      // JSONB ILIKE across every supported language path. The `?` arrow
      // ILIKE pattern that Supabase used over PostgREST translates here
      // to per-language OR ILIKE on the `->>` text extraction.
      const langCondition = LANGS.map(l => `title->>'${l}' ILIKE $1`).join(' OR ');
      const [products, menus, pages, posts] = await Promise.all([
        pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM public.products WHERE name ILIKE $1 LIMIT $2`,
          [pattern, PER_TABLE_LIMIT],
        ),
        pool.query<{ id: string; slug: string; title: Record<string, string> | null }>(
          `SELECT id, slug, title FROM public.menus WHERE ${langCondition} LIMIT $2`,
          [pattern, PER_TABLE_LIMIT],
        ),
        pool.query<{ id: string; slug: string; title: Record<string, string> | null }>(
          `SELECT id, slug, title FROM public.pages WHERE ${langCondition} LIMIT $2`,
          [pattern, PER_TABLE_LIMIT],
        ),
        pool.query<{ id: string; title: string; menu_id: string }>(
          `SELECT id, title, menu_id FROM public.posts WHERE title ILIKE $1 LIMIT $2`,
          [pattern, PER_TABLE_LIMIT],
        ),
      ]);
      const results: SearchHit[] = [];
      for (const p of products.rows) {
        results.push({ kind: 'product', id: p.id, label: p.name || '(이름 없음)', href: '/admin/products' });
      }
      for (const m of menus.rows) {
        results.push({ kind: 'menu', id: m.id, label: `${pickLabel(m.title, m.slug)} · /${m.slug}`, href: '/admin/menus' });
      }
      for (const p of pages.rows) {
        results.push({ kind: 'page', id: p.id, label: `${pickLabel(p.title, p.slug)} · /${p.slug}`, href: '/admin/pages' });
      }
      for (const p of posts.rows) {
        results.push({ kind: 'post', id: p.id, label: p.title || '(제목 없음)', href: '/admin/posts' });
      }
      return NextResponse.json({ results });
    } catch (err) {
      console.error('[admin/search] pg query failed:', err);
      return NextResponse.json({ results: [], error: 'search_failed' }, { status: 500 });
    }
  }

  // Supabase fallback retained for non-prod environments; matches the
  // shape of the previous client-side query.
  if (!supabase) return NextResponse.json({ results: [] }, { status: 500 });
  const orJsonb = (col: string) => LANGS.map(l => `${col}->>${l}.ilike.${pattern}`).join(',');
  const [products, menus, pages, posts] = await Promise.all([
    supabase.from('products').select('id,name').ilike('name', pattern).limit(PER_TABLE_LIMIT),
    supabase.from('menus').select('id,slug,title').or(orJsonb('title')).limit(PER_TABLE_LIMIT),
    supabase.from('pages').select('id,slug,title').or(orJsonb('title')).limit(PER_TABLE_LIMIT),
    supabase.from('posts').select('id,title,menu_id').ilike('title', pattern).limit(PER_TABLE_LIMIT),
  ]);
  const results: SearchHit[] = [];
  for (const p of (products.data ?? [])) results.push({ kind: 'product', id: (p as { id: string }).id, label: (p as { name: string }).name || '(이름 없음)', href: '/admin/products' });
  for (const m of (menus.data ?? [])) {
    const mm = m as { id: string; slug: string; title: Record<string, string> };
    results.push({ kind: 'menu', id: mm.id, label: `${pickLabel(mm.title, mm.slug)} · /${mm.slug}`, href: '/admin/menus' });
  }
  for (const p of (pages.data ?? [])) {
    const pp = p as { id: string; slug: string; title: Record<string, string> };
    results.push({ kind: 'page', id: pp.id, label: `${pickLabel(pp.title, pp.slug)} · /${pp.slug}`, href: '/admin/pages' });
  }
  for (const p of (posts.data ?? [])) results.push({ kind: 'post', id: (p as { id: string }).id, label: (p as { title: string }).title || '(제목 없음)', href: '/admin/posts' });
  return NextResponse.json({ results });
}
