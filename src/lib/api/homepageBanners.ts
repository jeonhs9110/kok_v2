import { cache } from 'react';
import { supabase } from '@/lib/api/products';

export interface HomepageBanner {
  id: string;
  text: Record<string, string>;
  link_url: string | null;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

const DEFAULTS = {
  bg_color: '#1f2937',
  text_color: '#ffffff',
};

export const getHomepageBanners = cache(async (): Promise<HomepageBanner[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('homepage_banners')
      .select('id,text,link_url,bg_color,text_color,is_active');
    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      text: typeof row.text === 'object' && row.text !== null ? row.text : {},
      link_url: row.link_url || null,
      bg_color: row.bg_color || DEFAULTS.bg_color,
      text_color: row.text_color || DEFAULTS.text_color,
      is_active: row.is_active ?? true,
    }));
  } catch {
    return [];
  }
});
