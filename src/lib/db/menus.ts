// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import { getPgPool } from './pool';
import type { MenuRow, PostRow } from './types';
import type { Menu, MenuWithChildren, Post } from '@/lib/api/menus';

/**
 * RDS-backed read API for menus + posts. Mirrors the Supabase variants
 * in `@/lib/api/menus` 1:1; dispatcher there picks based on USE_RDS.
 */

function rowToMenu(d: MenuRow): Menu {
  return {
    id: d.id,
    parent_id: d.parent_id,
    slug: d.slug,
    title: d.title,
    page_type: d.page_type,
    content: d.content,
    board_write_role: d.board_write_role,
    show_in_nav: d.show_in_nav,
    sort_order: d.sort_order,
    is_published: d.is_published,
    created_at: d.created_at,
  };
}

function rowToPost(d: PostRow): Post {
  return {
    id: d.id,
    menu_id: d.menu_id,
    title: d.title,
    content: d.content,
    author_name: d.author_name,
    author_id: d.author_id,
    is_admin_post: d.is_admin_post,
    is_published: d.is_published,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

export async function getMenuTreeFromPg(): Promise<MenuWithChildren[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<MenuRow>(
    `SELECT * FROM public.menus
      WHERE is_published = true
      ORDER BY sort_order ASC`,
  );
  const all = rows.map(rowToMenu);
  const parents = all.filter(m => !m.parent_id);
  return parents.map(p => ({
    ...p,
    children: all.filter(c => c.parent_id === p.id),
  }));
}

export async function getAllMenusFromPg(): Promise<Menu[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<MenuRow>(
    `SELECT * FROM public.menus
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(rowToMenu);
}

export async function getMenuBySlugFromPg(slug: string): Promise<Menu | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<MenuRow>(
    `SELECT * FROM public.menus
      WHERE slug = $1 AND is_published = true
      LIMIT 1`,
    [slug],
  );
  return rows[0] ? rowToMenu(rows[0]) : null;
}

export async function getPostByIdFromPg(postId: string): Promise<Post | null> {
  const pool = getPgPool();
  const { rows } = await pool.query<PostRow>(
    `SELECT * FROM public.posts
      WHERE id = $1 AND is_published = true
      LIMIT 1`,
    [postId],
  );
  return rows[0] ? rowToPost(rows[0]) : null;
}
