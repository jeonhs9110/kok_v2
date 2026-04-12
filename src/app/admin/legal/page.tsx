'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Save, FileText, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface LegalPage { id: number; slug: string; title_kr: string; title_en: string; content_kr: string; content_en: string; is_published: boolean; }
interface BusinessInfo { company_name_kr: string; company_name_en: string; ceo_name: string; business_reg_number: string; mail_order_number: string; address_kr: string; address_en: string; phone: string; email: string; bank_name: string; bank_account: string; bank_holder: string; instagram_url: string; youtube_url: string; cs_hours_kr: string; cs_hours_en: string; cs_lunch_kr: string; cs_lunch_en: string; cs_holiday_kr: string; cs_holiday_en: string; privacy_officer_name: string; privacy_officer_email: string; }

export default function LegalAdminPage() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [biz, setBiz] = useState<BusinessInfo>({ company_name_kr: '', company_name_en: '', ceo_name: '', business_reg_number: '', mail_order_number: '', address_kr: '', address_en: '', phone: '', email: '', bank_name: '', bank_account: '', bank_holder: '', instagram_url: '', youtube_url: '', cs_hours_kr: '', cs_hours_en: '', cs_lunch_kr: '', cs_lunch_en: '', cs_holiday_kr: '', cs_holiday_en: '', privacy_officer_name: '', privacy_officer_email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState('terms');
  const [editLang, setEditLang] = useState<'kr' | 'en'>('kr');

  useEffect(() => { load(); }, []);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    try {
      const [pagesRes, bizRes] = await Promise.all([
        supabase.from('legal_pages').select('*').order('id'),
        supabase.from('business_info').select('*').single(),
      ]);
      if (pagesRes.data) setPages(pagesRes.data);
      if (bizRes.data) setBiz(bizRes.data as BusinessInfo);
    } catch {}
    setLoading(false);
  }

  async function savePage(p: LegalPage) {
    if (!supabase) return;
    setSaving(p.slug);
    await supabase.from('legal_pages').update({ title_kr: p.title_kr, title_en: p.title_en, content_kr: p.content_kr, content_en: p.content_en, is_published: p.is_published }).eq('id', p.id);
    setSaved(p.slug); setTimeout(() => setSaved(null), 2000); setSaving(null);
  }

  async function saveBiz() {
    if (!supabase) return;
    setSaving('biz');
    await supabase.from('business_info').upsert({ id: 1, ...biz });
    setSaved('biz'); setTimeout(() => setSaved(null), 2000); setSaving(null);
  }

  function updatePage(slug: string, updates: Partial<LegalPage>) {
    setPages(prev => prev.map(p => p.slug === slug ? { ...p, ...updates } : p));
  }

  const SectionBtn = ({ id, title, icon: Icon }: { id: string; title: string; icon: React.ElementType }) => (
    <button onClick={() => setOpenSection(openSection === id ? '' : id)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-gray-500" /><h2 className="text-lg font-bold text-gray-800">{title}</h2></div>
      {openSection === id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
  );

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Legal Pages */}
      {pages.map(p => (
        <div key={p.slug} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn id={p.slug} title={p.slug === 'terms' ? '이용약관 (Terms of Service)' : '개인정보처리방침 (Privacy Policy)'} icon={FileText} />
          {openSection === p.slug && (
            <div className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button onClick={() => setEditLang('kr')} className={`px-3 py-1.5 text-xs font-semibold rounded ${editLang === 'kr' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>한국어</button>
                  <button onClick={() => setEditLang('en')} className={`px-3 py-1.5 text-xs font-semibold rounded ${editLang === 'en' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>English</button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.is_published} onChange={() => updatePage(p.slug, { is_published: !p.is_published })} className="w-4 h-4 rounded" />
                  공개
                </label>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">제목</label>
                <input type="text" value={editLang === 'kr' ? p.title_kr : p.title_en} onChange={e => updatePage(p.slug, editLang === 'kr' ? { title_kr: e.target.value } : { title_en: e.target.value })} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">본문 내용</label>
                <textarea value={editLang === 'kr' ? p.content_kr : p.content_en} onChange={e => updatePage(p.slug, editLang === 'kr' ? { content_kr: e.target.value } : { content_en: e.target.value })} rows={18} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono leading-relaxed resize-y" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => savePage(p)} disabled={saving === p.slug} className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${saved === p.slug ? 'bg-green-500 text-white' : 'bg-[#111] text-white hover:bg-black'} disabled:opacity-50`}>
                  <Save className="w-4 h-4" />{saving === p.slug ? '저장 중...' : saved === p.slug ? '✓ 저장 완료' : '저장'}
                </button>
                <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">미리보기 <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Business Info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <SectionBtn id="biz" title="사업자 정보 (Business Info)" icon={Building2} />
        {openSection === 'biz' && (
          <div className="p-5 pt-0 space-y-4">
            <p className="text-sm text-gray-500">전자상거래법에 따라 사이트 하단(Footer)에 표시되는 사업자 정보입니다.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['company_name_kr', '상호 (한국어)'], ['company_name_en', 'Company Name (EN)'],
                ['ceo_name', '대표자명'], ['business_reg_number', '사업자등록번호'],
                ['mail_order_number', '통신판매업신고번호'], ['phone', '대표 전화번호'],
                ['email', '대표 이메일'], ['address_kr', '주소 (한국어)'],
                ['address_en', 'Address (EN)'], ['bank_name', '은행명'],
                ['bank_account', '계좌번호'], ['bank_holder', '예금주'],
                ['instagram_url', 'Instagram URL'], ['youtube_url', 'YouTube URL'],
                ['cs_hours_kr', '고객센터 운영시간 (KR)'], ['cs_hours_en', 'CS Hours (EN)'],
                ['cs_lunch_kr', '점심시간 (KR)'], ['cs_lunch_en', 'Lunch (EN)'],
                ['cs_holiday_kr', '휴무일 (KR)'], ['cs_holiday_en', 'Holiday (EN)'],
                ['privacy_officer_name', '개인정보 보호책임자'], ['privacy_officer_email', '보호책임자 이메일'],
              ] as [string, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">{label}</label>
                  <input type="text" value={(biz as any)[key] || ''} onChange={e => setBiz(prev => ({ ...prev, [key]: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
            <button onClick={saveBiz} disabled={saving === 'biz'} className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${saved === 'biz' ? 'bg-green-500 text-white' : 'bg-[#111] text-white hover:bg-black'} disabled:opacity-50`}>
              <Save className="w-4 h-4" />{saving === 'biz' ? '저장 중...' : saved === 'biz' ? '✓ 저장 완료' : '사업자 정보 저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
