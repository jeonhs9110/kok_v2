import { supabase } from './products';

export interface Menu {
  id: string;
  parent_id: string | null;
  slug: string;
  title: Record<string, string>;
  page_type: 'page' | 'board';
  content: Record<string, string>;
  board_write_role: 'admin' | 'user';
  show_in_nav: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface MenuWithChildren extends Menu {
  children: Menu[];
}

export interface Post {
  id: string;
  menu_id: string;
  title: string;
  content: string;
  author_name: string;
  author_id: string | null;
  is_admin_post: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  content: string;
  is_admin_comment: boolean;
  created_at: string;
}

// Phase C1: dispatcher reads + writes. RDS path activates when
// USE_RDS=true (Phase F cutover). Until then, Supabase branch serves
// every call in prod.
export async function getMenuTree(): Promise<MenuWithChildren[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getMenuTreeFromPg } = await import('@/lib/db/menus');
      return await getMenuTreeFromPg();
    } catch (err) {
      console.error('[menus] RDS getMenuTree failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];

  const parents = data.filter((m: Menu) => !m.parent_id);
  return parents.map((p: Menu) => ({
    ...p,
    children: data.filter((c: Menu) => c.parent_id === p.id),
  }));
}

export async function getAllMenus(): Promise<Menu[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getAllMenusFromPg } = await import('@/lib/db/menus');
      return await getAllMenusFromPg();
    } catch (err) {
      console.error('[menus] RDS getAllMenus failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getMenuBySlug(slug: string): Promise<Menu | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getMenuBySlugFromPg } = await import('@/lib/db/menus');
      return await getMenuBySlugFromPg(slug);
    } catch (err) {
      console.error('[menus] RDS getMenuBySlug failed:', err);
      return null;
    }
  }
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getPostsByMenu(menuId: string): Promise<Post[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPostsByMenuFromPg } = await import('@/lib/db/storefront-reads');
      return (await getPostsByMenuFromPg(menuId)) as unknown as Post[];
    } catch (err) {
      console.error('[menus] RDS getPostsByMenu failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('menu_id', menuId)
    .eq('is_published', true)
    .order('is_admin_post', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function getPostsByMenuPaginated(
  menuId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ posts: Post[]; totalCount: number }> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPostsByMenuPaginatedFromPg } = await import('@/lib/db/storefront-reads');
      const { posts, total } = await getPostsByMenuPaginatedFromPg(menuId, page, pageSize);
      return { posts: posts as unknown as Post[], totalCount: total };
    } catch (err) {
      console.error('[menus] RDS getPostsByMenuPaginated failed:', err);
      return { posts: [], totalCount: 0 };
    }
  }
  if (!supabase) return { posts: [], totalCount: 0 };

  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('menu_id', menuId)
    .eq('is_published', true);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('menu_id', menuId)
    .eq('is_published', true)
    .order('is_admin_post', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  return {
    posts: error || !data ? [] : data,
    totalCount: count ?? 0,
  };
}

/**
 * Public-facing post fetcher. Requires `is_published = true`; admins can
 * see drafts through their own queries that explicitly bypass this. Without
 * the filter, a customer with a guessable / shared URL could read draft
 * posts the operator hasn't released yet.
 */
export async function getPostById(postId: string): Promise<Post | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPostByIdFromPg } = await import('@/lib/db/menus');
      return await getPostByIdFromPg(postId);
    } catch (err) {
      console.error('[menus] RDS getPostById failed:', err);
      return null;
    }
  }
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('is_published', true)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getCommentsByPost(postId: string): Promise<Comment[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getCommentsByPostFromPg } = await import('@/lib/db/storefront-reads');
      return (await getCommentsByPostFromPg(postId)) as unknown as Comment[];
    } catch (err) {
      console.error('[menus] RDS getCommentsByPost failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function createComment(data: {
  post_id: string;
  parent_id?: string | null;
  author_name: string;
  content: string;
  is_admin_comment: boolean;
}): Promise<Comment | null> {
  if (!supabase) return null;
  const { data: row, error } = await supabase
    .from('comments')
    .insert({
      post_id: data.post_id,
      parent_id: data.parent_id || null,
      author_name: data.author_name,
      content: data.content,
      is_admin_comment: data.is_admin_comment,
    })
    .select()
    .single();
  if (error || !row) return null;
  return row;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);
  return !error;
}

export async function updatePost(
  postId: string,
  data: { title: string; content: string }
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('posts')
    .update({ title: data.title, content: data.content, updated_at: new Date().toISOString() })
    .eq('id', postId);
  return !error;
}

export async function deletePost(postId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);
  return !error;
}
