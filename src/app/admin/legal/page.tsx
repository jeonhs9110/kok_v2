'use client';

import { useState } from 'react';
import { Save, FileText, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useLegal, type LegalPage } from './_components/useLegal';

// Footer visibility groups — match those checked in src/components/Footer.tsx
const FOOTER_GROUPS: { key: string; label: string; desc: string }[] = [
  { key: 'company',  label: '회사 정보',     desc: '상호 / 대표 / 사업자등록번호 / 통신판매업신고번호' },
  { key: 'address',  label: '주소',          desc: '주소 줄' },
  { key: 'email',    label: '이메일',        desc: '대표 이메일 줄' },
  { key: 'phone',    label: '대표 전화번호', desc: '고객센터 칸의 큰 전화번호' },
  { key: 'cs_hours', label: '운영시간',      desc: '영업시간 / 점심시간 / 휴무일' },
  { key: 'bank',     label: '계좌 정보',     desc: '은행 / 계좌번호 / 예금주 전체 칸' },
  { key: 'social',   label: 'SNS 아이콘',    desc: 'Instagram / YouTube 아이콘' },
];

type BizFieldType = 'text' | 'email' | 'url' | 'tel';
interface BizFieldSpec {
  key: string;
  label: string;
  type: BizFieldType;
  placeholder?: string;
}
// Typed field defs so the operator gets the right mobile keyboard
// and format hint for URLs / emails / phones. Prior version was all
// bare text inputs — instagram_url = "www.instagram.com/kokkok" (no
// scheme) rendered as a broken relative link on the storefront
// footer, and the operator had no format hint to catch the mistake.
const BIZ_FIELDS: BizFieldSpec[] = [
  { key: 'company_name_kr', label: '상호 (한국어)', type: 'text' },
  { key: 'company_name_en', label: 'Company Name (EN)', type: 'text' },
  { key: 'ceo_name', label: '대표자명', type: 'text' },
  { key: 'business_reg_number', label: '사업자등록번호', type: 'text' },
  { key: 'mail_order_number', label: '통신판매업신고번호', type: 'text' },
  { key: 'phone', label: '대표 전화번호', type: 'tel', placeholder: '02-1234-5678' },
  { key: 'email', label: '대표 이메일', type: 'email', placeholder: 'hello@kokkokgarden.com' },
  { key: 'address_kr', label: '주소 (한국어)', type: 'text' },
  { key: 'address_en', label: 'Address (EN)', type: 'text' },
  { key: 'bank_name', label: '은행명', type: 'text' },
  { key: 'bank_account', label: '계좌번호', type: 'text' },
  { key: 'bank_holder', label: '예금주', type: 'text' },
  { key: 'instagram_url', label: 'Instagram URL', type: 'url', placeholder: 'https://www.instagram.com/kokkok' },
  { key: 'youtube_url', label: 'YouTube URL', type: 'url', placeholder: 'https://www.youtube.com/@kokkok' },
  { key: 'cs_hours_kr', label: '고객센터 운영시간 (KR)', type: 'text' },
  { key: 'cs_hours_en', label: 'CS Hours (EN)', type: 'text' },
  { key: 'cs_lunch_kr', label: '점심시간 (KR)', type: 'text' },
  { key: 'cs_lunch_en', label: 'Lunch (EN)', type: 'text' },
  { key: 'cs_holiday_kr', label: '휴무일 (KR)', type: 'text' },
  { key: 'cs_holiday_en', label: 'Holiday (EN)', type: 'text' },
  { key: 'privacy_officer_name', label: '개인정보 보호책임자', type: 'text' },
  { key: 'privacy_officer_email', label: '보호책임자 이메일', type: 'email' },
];

function SectionBtn({
  id, title, icon: Icon, openSection, setOpenSection,
}: {
  id: string; title: string; icon: React.ElementType;
  openSection: string; setOpenSection: (v: string) => void;
}) {
  return (
    <button onClick={() => setOpenSection(openSection === id ? '' : id)} className="w-full flex items-center justify-between p-5 hover:bg-[#fafbfc] transition-colors">
      <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-[#6b7280]" /><h2 className="text-[14px] font-bold text-[#1f2937]">{title}</h2></div>
      {openSection === id ? <ChevronUp className="w-5 h-5 text-[#9ca3af]" /> : <ChevronDown className="w-5 h-5 text-[#9ca3af]" />}
    </button>
  );
}

export default function LegalAdminPage() {
  const { pages, biz, setBiz, loading, saving, saved, updatePage, savePage, saveBiz } = useLegal();
  const [openSection, setOpenSection] = useState('terms');
  const [editLang, setEditLang] = useState<'kr' | 'en'>('kr');

  if (loading) return <div className="text-[#6b7280]">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Legal Pages */}
      {pages.map((p: LegalPage) => (
        <div key={p.slug} className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
          <SectionBtn id={p.slug} title={p.slug === 'terms' ? '이용약관 (Terms of Service)' : '개인정보처리방침 (Privacy Policy)'} icon={FileText} openSection={openSection} setOpenSection={setOpenSection} />
          {openSection === p.slug && (
            <div className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button onClick={() => setEditLang('kr')} className={`px-3 py-1.5 text-xs font-semibold rounded ${editLang === 'kr' ? 'bg-[#1f2937] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>한국어</button>
                  <button onClick={() => setEditLang('en')} className={`px-3 py-1.5 text-xs font-semibold rounded ${editLang === 'en' ? 'bg-[#1f2937] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>영어</button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.is_published} onChange={() => updatePage(p.slug, { is_published: !p.is_published })} className="w-4 h-4 rounded" />
                  공개
                </label>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#6b7280] uppercase">제목</label>
                <input type="text" value={editLang === 'kr' ? p.title_kr : p.title_en} onChange={e => updatePage(p.slug, editLang === 'kr' ? { title_kr: e.target.value } : { title_en: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#6b7280] uppercase">본문 내용</label>
                <textarea value={editLang === 'kr' ? p.content_kr : p.content_en} onChange={e => updatePage(p.slug, editLang === 'kr' ? { content_kr: e.target.value } : { content_en: e.target.value })} rows={18} className="w-full mt-1 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed resize-y" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => savePage(p)} disabled={saving === p.slug} className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${saved === p.slug ? 'bg-[#16a34a] text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
                  <Save className="w-4 h-4" />{saving === p.slug ? '저장 중...' : saved === p.slug ? '✓ 저장 완료' : '저장'}
                </button>
                <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#3b82f6] flex items-center gap-1 hover:underline">미리보기 <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Business Info */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <SectionBtn id="biz" title="사업자 정보 (Business Info)" icon={Building2} openSection={openSection} setOpenSection={setOpenSection} />
        {openSection === 'biz' && (
          <div className="p-5 pt-0 space-y-4">
            <p className="text-sm text-[#6b7280]">전자상거래법에 따라 사이트 하단(Footer)에 표시되는 사업자 정보입니다.</p>

            {/* Footer visibility toggles */}
            <div className="bg-[#fafbfc] border border-[#e5e7eb] rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wider">푸터 표시 항목</p>
              <p className="text-[11px] text-[#6b7280] mb-2">아래에서 체크 해제하면 해당 항목이 풋터에서 숨겨집니다 (데이터는 유지).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
                {FOOTER_GROUPS.map(g => {
                  const shown = !biz.hidden_fields.includes(g.key);
                  return (
                    <label key={g.key} className="flex items-start gap-2 cursor-pointer hover:bg-white/50 px-2 py-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => {
                          setBiz(prev => ({
                            ...prev,
                            hidden_fields: shown
                              ? [...prev.hidden_fields, g.key]
                              : prev.hidden_fields.filter(k => k !== g.key),
                          }));
                        }}
                        className="mt-0.5 w-4 h-4 accent-[#00693A] cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1f2937]">{g.label}</p>
                        <p className="text-[10px] text-[#6b7280] truncate" title={g.desc}>{g.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {BIZ_FIELDS.map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold text-[#6b7280] uppercase">{label}</label>
                  <input
                    type={type}
                    value={(biz as unknown as Record<string, string>)[key] || ''}
                    onChange={e => setBiz(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              ))}
            </div>
            <button onClick={saveBiz} disabled={saving === 'biz'} className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${saved === 'biz' ? 'bg-[#16a34a] text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
              <Save className="w-4 h-4" />{saving === 'biz' ? '저장 중...' : saved === 'biz' ? '✓ 저장 완료' : '사업자 정보 저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
