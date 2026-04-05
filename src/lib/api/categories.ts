import { supabase } from './products';

export interface Category {
  id: string;
  parent_id: string | null;
  slug: string;
  name: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export async function getCategoriesTree(): Promise<CategoryWithChildren[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];

  const parents = data.filter(c => !c.parent_id);
  return parents.map(p => ({
    ...p,
    children: data.filter(c => c.parent_id === p.id),
  }));
}

export async function getAllCategories(): Promise<Category[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}
