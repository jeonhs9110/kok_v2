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
  if (process.env.USE_RDS === 'true') {
    try {
      const { getCategoriesTreeFromPg } = await import('@/lib/db/storefront-reads');
      const all = (await getCategoriesTreeFromPg()) as unknown as Category[];
      const parents = all.filter(c => !c.parent_id);
      return parents.map(p => ({ ...p, children: all.filter(c => c.parent_id === p.id) }));
    } catch (err) {
      console.error('[categories] RDS getCategoriesTree failed:', err);
      return [];
    }
  }
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
  if (process.env.USE_RDS === 'true') {
    try {
      const { getAllCategoriesFromPg } = await import('@/lib/db/storefront-reads');
      return (await getAllCategoriesFromPg()) as unknown as Category[];
    } catch (err) {
      console.error('[categories] RDS getAllCategories failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}
