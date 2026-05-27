/**
 * Shared types + helpers for the admin/worldwide editors.
 *
 * Lives here (not in src/lib/worldwide/) because nothing outside the
 * admin/worldwide route reads it; keeping it co-located prevents
 * accidental imports from the public storefront.
 */

import { supabase } from '@/lib/api/products';
import {
  DEFAULT_LABELS,
  SUPPORTED_LANGS,
  type WorldwideLabels,
  type WorldwideLang,
} from '@/lib/worldwide/defaults';

export type LangColumns = Record<WorldwideLang, string>;
export type LabelRow = { label_key: string } & LangColumns;

export interface RetailerRow {
  id: number | null;
  country_code: string;
  country_native: string;
  country_en: string;
  region: string;
  store_name: string;
  store_url: string;
  store_logo_url: string;
  country_image_url: string;
  banner_color: string;
  is_active: boolean;
  sort_order: number;
}

export const EMPTY_RETAILER: RetailerRow = {
  id: null,
  country_code: '',
  country_native: '',
  country_en: '',
  region: 'ASIA',
  store_name: '',
  store_url: '#',
  store_logo_url: '',
  country_image_url: '',
  banner_color: '#111111',
  is_active: true,
  sort_order: 0,
};

const ASSETS_BUCKET = 'site-assets';

export async function uploadWorldwideAsset(
  file: File,
  prefix: 'vendor-logo' | 'country-image'
): Promise<string> {
  if (!supabase) throw new Error('Supabase 클라이언트 없음');
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `worldwide/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function buildDefaultLabelRow(key: keyof WorldwideLabels): LabelRow {
  const row: LabelRow = { label_key: key, kr: '', en: '', cn: '', jp: '', vn: '', th: '' };
  for (const lang of SUPPORTED_LANGS) {
    row[lang] = DEFAULT_LABELS[lang][key] ?? '';
  }
  return row;
}

export const LANG_LABEL: Record<WorldwideLang, string> = {
  kr: '한국어',
  en: 'English',
  cn: '中文',
  jp: '日本語',
  vn: 'Tiếng Việt',
  th: 'ภาษาไทย',
};

export const LABEL_SECTION_TITLE: Record<string, string> = {
  hero_badge: '히어로 배지',
  hero_title: '히어로 제목',
  hero_sub: '히어로 부제목',
  breadcrumb_home: '브레드크럼 - 홈',
  breadcrumb_worldwide: '브레드크럼 - 월드와이드',
  filter_label: '지역 필터 라벨',
  region_all: '전체 (ALL)',
  region_asia: '아시아',
  region_north_america: '북미',
  region_south_america: '남미',
  region_europe: '유럽',
  region_oceania: '오세아니아',
  region_middle_east: '중동',
  region_africa: '아프리카',
  region_cis: 'CIS',
  visit_store: '스토어 방문 버튼',
  coming_soon: '준비중 배지',
  partner_badge: '파트너 배지',
  partner_title: '파트너 문의 제목',
  partner_body: '파트너 문의 본문',
};
