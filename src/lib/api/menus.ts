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

export async function getMenuTree(): Promise<MenuWithChildren[]> {
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

export async function getPostById(postId: string): Promise<Post | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getCommentsByPost(postId: string): Promise<Comment[]> {
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
