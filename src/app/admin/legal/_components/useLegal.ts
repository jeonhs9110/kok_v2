import { useEffect, useState } from 'react';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';

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
 * State + handlers for /admin/legal. Reads/writes go through the
 * generic admin-CRUD route (/api/admin/crud/legal_pages and
 * /api/admin/crud/business_info), which dispatches to RDS via the
 * standard USE_RDS flag.
 */
export function useLegal() {
  const toast = useToast();
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [biz, setBiz] = useState<BusinessInfo>(EMPTY_BIZ);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    try {
      const [pagesRes, bizRes] = await Promise.all([
        fetch('/api/admin/crud/legal_pages?orderBy=id&direction=ASC', { cache: 'no-store' }),
        fetch('/api/admin/crud/business_info?orderBy=id&direction=ASC', { cache: 'no-store' }),
      ]);
      if (pagesRes.ok) {
        const j = (await pagesRes.json()) as { rows?: LegalPage[] };
        setPages(j.rows ?? []);
      }
      if (bizRes.ok) {
        const j = (await bizRes.json()) as { rows?: BusinessInfo[] };
        const row = (j.rows ?? [])[0];
        if (row) setBiz({ ...row, hidden_fields: row.hidden_fields ?? [] });
      }
    } catch (err) {
      console.error('법적 페이지 관리자 로드 실패:', err);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function savePage(p: LegalPage) {
    setSaving(p.slug);
    try {
      const res = await fetch('/api/admin/crud/legal_pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          patch: {
            title_kr: p.title_kr, title_en: p.title_en,
            content_kr: p.content_kr, content_en: p.content_en,
            is_published: p.is_published,
          },
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      await revalidateHeaderData();
      setSaved(p.slug);
      setTimeout(() => setSaved(null), 2000);
      toast.show('약관 페이지가 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/legal] savePage failed:', err);
      toast.show('약관 페이지 저장에 실패했습니다.', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function saveBiz() {
    setSaving('biz');
    try {
      // business_info is a singleton (id=1). PATCH the existing row; if
      // missing, fall through to insert. The audit caught that earlier the
      // success toast fired even when both calls returned non-2xx — now
      // the operator only sees ✓ if at least one succeeded.
      let ok = false;
      const patchRes = await fetch('/api/admin/crud/business_info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, patch: biz }),
      });
      if (patchRes.ok) {
        ok = true;
      } else {
        const postRes = await fetch('/api/admin/crud/business_info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 1, ...biz }),
        });
        ok = postRes.ok;
      }
      if (!ok) throw new Error('both patch and post failed');
      await revalidateHeaderData();
      setSaved('biz');
      setTimeout(() => setSaved(null), 2000);
      toast.show('사업자 정보가 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/legal] saveBiz failed:', err);
      toast.show('사업자 정보 저장에 실패했습니다.', 'error');
    } finally {
      setSaving(null);
    }
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
