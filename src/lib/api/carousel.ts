import { supabase } from './products';

export interface CarouselSlide {
  id: string;
  badge: Record<string, string>;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  image_url: string | null;
  bg_color: string;
  text_color?: string;
  badge_bg_color?: string;
  badge_text_color?: string;
  title_size_offset?: number;
  subtitle_size_offset?: number;
  badge_size_offset?: number;
  sort_order: number;
  is_active: boolean;
  link_url: string | null;
  display_mode: 'default' | 'fullpage';
  media_type: 'image' | 'video' | 'gif';
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
