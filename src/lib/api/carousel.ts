import { supabase } from './products';

export interface CarouselSlide {
  id: string;
  badge: Record<string, string>;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  image_url: string | null;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export async function getActiveSlides(): Promise<CarouselSlide[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getAllSlides(): Promise<CarouselSlide[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}
