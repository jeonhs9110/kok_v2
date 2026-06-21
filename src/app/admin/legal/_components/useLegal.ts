import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHeaderData } from '@/lib/cache/invalidate';

const supabase = getSupabaseBrowser();

export interface LegalPage {
  id: number;
  slug: string;
  title_kr: string;
  title_en: string;
  content_kr: string;
  content_en: string;
  is_published: boolean;
}

export interface BusinessInfo {
  company_name_kr: string;
  company_name_en: string;
  ceo_name: string;
  business_reg_number: string;
  mail_order_number: string;
  address_kr: string;
  address_en: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  instagram_url: string;
  youtube_url: string;
  cs_hours_kr: string;
  cs_hours_en: string;
  cs_lunch_kr: string;
  cs_lunch_en: string;
  cs_holiday_kr: string;
  cs_holiday_en: string;
  privacy_officer_name: string;
  privacy_officer_email: string;
  hidden_fields: string[];
}

const EMPTY_BIZ: BusinessInfo = {
  company_name_kr: '', company_name_en: '', ceo_name: '', business_reg_number: '',
  mail_order_number: '', address_kr: '', address_en: '', phone: '', email: '',
  bank_name: '', bank_account: '', bank_holder: '', instagram_url: '', youtube_url: '',
  cs_hours_kr: '', cs_hours_en: '', cs_lunch_kr: '', cs_lunch_en: '',
  cs_holiday_kr: '', cs_holiday_en: '',
  privacy_officer_name: '', privacy_officer_email: '', hidden_fields: [],
};

/**
 * State + handlers for /admin/legal. Owns the legal pages list, business
 * info row, save markers keyed by slug/'biz', and the per-row update
 * helpers. Same admin-JWT pattern as the rest of post-#187 admin.
 */
export function useLegal() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [biz, setBiz] = useState<BusinessInfo>(EMPTY_BIZ);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    try {
      const [pagesRes, bizRes] = await Promise.all([
        supabase.from('legal_pages').select('*').order('id'),
        supabase.from('business_info').select('*').maybeSingle(),
      ]);
      if (pagesRes.error) console.error('약관 페이지 로드 실패:', pagesRes.error);
      if (bizRes.error) console.error('사업자 정보 로드 실패:', bizRes.error);
      if (pagesRes.data) setPages(pagesRes.data);
      if (bizRes.data) {
        const d = bizRes.data as BusinessInfo;
        setBiz({ ...d, hidden_fields: d.hidden_fields ?? [] });
      }
    } catch (err) {
      console.error('법적 페이지 관리자 로드 실패:', err);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function savePage(p: LegalPage) {
    if (!supabase) return;
    setSaving(p.slug);
    await supabase.from('legal_pages').update({
      title_kr: p.title_kr, title_en: p.title_en,
      content_kr: p.content_kr, content_en: p.content_en,
      is_published: p.is_published,
    }).eq('id', p.id);
    // Audit 2026-06-21: footer + /terms + /privacy weren't refreshing
    // until the 60s ISR TTL expired.
    await revalidateHeaderData();
    setSaved(p.slug);
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  async function saveBiz() {
    if (!supabase) return;
    setSaving('biz');
    await supabase.from('business_info').upsert({ id: 1, ...biz });
    await revalidateHeaderData();
    setSaved('biz');
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  function updatePage(slug: string, updates: Partial<LegalPage>) {
    setPages(prev => prev.map(p => p.slug === slug ? { ...p, ...updates } : p));
  }

  return {
    pages, biz, setBiz,
    loading, saving, saved,
    updatePage, savePage, saveBiz,
  };
}
