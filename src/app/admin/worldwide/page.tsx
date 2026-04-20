'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Save, Plus, Trash2, ChevronDown, ChevronUp, Globe, List, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import {
  LABEL_KEYS,
  DEFAULT_LABELS,
  DEFAULT_RETAILERS,
  REGION_ORDER,
  SUPPORTED_LANGS,
  type WorldwideLabels,
  type WorldwideLang,
  type Region,
} from '@/lib/worldwide/defaults';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const LANG_LABEL: Record<WorldwideLang, string> = {
  kr: '한국어', en: 'English', cn: '中文', jp: '日本語', vn: 'Tiếng Việt', th: 'ภาษาไทย',
};

const LABEL_SECTION_TITLE: Record<string, string> = {
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

type LangColumns = Record<WorldwideLang, string>;
type LabelRow = { label_key: string } & LangColumns;

interface RetailerRow {
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

const EMPTY_RETAILER: RetailerRow = {
  id: null, country_code: '', country_native: '', country_en: '',
  region: 'ASIA', store_name: '', store_url: '#',
  store_logo_url: '', country_image_url: '',
  banner_color: '#111111', is_active: true, sort_order: 0,
};

const ASSETS_BUCKET = 'site-assets';

async function uploadWorldwideAsset(file: File, prefix: 'vendor-logo' | 'country-image'): Promise<string> {
  if (!supabase) throw new Error('No Supabase client');
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `worldwide/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function buildDefaultLabelRow(key: keyof WorldwideLabels): LabelRow {
  const row: LabelRow = { label_key: key, kr: '', en: '', cn: '', jp: '', vn: '', th: '' };
  for (const lang of SUPPORTED_LANGS) {
    row[lang] = DEFAULT_LABELS[lang][key] ?? '';
  }
  return row;
}

export default function WorldwideAdminPage() {
  const [tab, setTab] = useState<'labels' | 'retailers'>('labels');
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [editLang, setEditLang] = useState<WorldwideLang>('kr');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState<string>('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const defaultLabels = LABEL_KEYS.map(k => buildDefaultLabelRow(k));

    if (!supabase) {
      setLabels(defaultLabels);
      setRetailers(DEFAULT_RETAILERS.map((r, i) => ({
        id: null, country_code: r.countryCode, country_native: r.country, country_en: r.countryEn,
        region: r.region, store_name: r.storeName, store_url: r.storeUrl,
        store_logo_url: '', country_image_url: '',
        banner_color: r.bannerColor, is_active: true, sort_order: (i + 1) * 10,
      })));
      setLoading(false);
      return;
    }

    try {
      const [lRes, rRes] = await Promise.all([
        supabase.from('worldwide_labels').select('*'),
        supabase.from('worldwide_retailers').select('*').order('sort_order'),
      ]);

      const byKey = new Map<string, LabelRow>((lRes.data as LabelRow[] | null)?.map(r => [r.label_key, r]) ?? []);
      setLabels(LABEL_KEYS.map(k => byKey.get(k) ?? buildDefaultLabelRow(k)));

      if (rRes.data && rRes.data.length > 0) {
        setRetailers(rRes.data as RetailerRow[]);
      } else {
        setRetailers(DEFAULT_RETAILERS.map((r, i) => ({
          id: null, country_code: r.countryCode, country_native: r.country, country_en: r.countryEn,
          region: r.region, store_name: r.storeName, store_url: r.storeUrl,
          store_logo_url: '', country_image_url: '',
          banner_color: r.bannerColor, is_active: true, sort_order: (i + 1) * 10,
        })));
      }
    } catch {
      setLabels(defaultLabels);
    }
    setLoading(false);
  }

  function updateLabel(key: string, lang: WorldwideLang, value: string) {
    setLabels(prev => prev.map(r => r.label_key === key ? { ...r, [lang]: value } : r));
  }

  async function saveLabel(row: LabelRow) {
    if (!supabase) {
      alert('Supabase가 설정되지 않았습니다. 환경변수를 확인하세요.');
      return;
    }
    setSavingKey(row.label_key);
    const { error } = await supabase.from('worldwide_labels').upsert({
      label_key: row.label_key,
      kr: row.kr, en: row.en, cn: row.cn, jp: row.jp, vn: row.vn, th: row.th,
      updated_at: new Date().toISOString(),
    });
    setSavingKey(null);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setSavedKey(row.label_key);
    setTimeout(() => setSavedKey(null), 1500);
  }

  // ─── Retailer handlers ─────────────────────────────────────────────
  function updateRetailer(index: number, patch: Partial<RetailerRow>) {
    setRetailers(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }

  function addRetailer() {
    const nextSort = retailers.length > 0
      ? Math.max(...retailers.map(r => r.sort_order)) + 10
      : 10;
    setRetailers(prev => [...prev, { ...EMPTY_RETAILER, sort_order: nextSort }]);
  }

  async function saveRetailer(index: number) {
    if (!supabase) { alert('Supabase가 설정되지 않았습니다.'); return; }
    const r = retailers[index];
    if (!r.country_code || !r.country_native || !r.country_en) {
      alert('국가 코드, 원어명, 영문명은 필수입니다.');
      return;
    }
    setSavingKey(`retailer-${index}`);
    const code = r.country_code.toLowerCase().trim();
    const payload = {
      country_code: code,
      country_native: r.country_native,
      country_en: r.country_en,
      region: r.region,
      store_name: r.store_name,
      store_url: r.store_url || '#',
      store_logo_url: r.store_logo_url || '',
      country_image_url: r.country_image_url || '',
      banner_color: r.banner_color || '#111111',
      is_active: r.is_active,
      sort_order: r.sort_order,
      updated_at: new Date().toISOString(),
    };
    const res = r.id
      ? await supabase.from('worldwide_retailers').update(payload).eq('id', r.id).select().single()
      : await supabase.from('worldwide_retailers').insert(payload).select().single();
    if (res.error) {
      setSavingKey(null);
      alert(`저장 실패: ${res.error.message}`);
      return;
    }
    if (res.data) updateRetailer(index, { id: (res.data as RetailerRow).id });

    // Sync country_image_url + banner_color across all rows of the same country_code
    if (code) {
      await supabase.from('worldwide_retailers')
        .update({ country_image_url: r.country_image_url || '', banner_color: r.banner_color || '#111111' })
        .eq('country_code', code);
      setRetailers(prev => prev.map(row => row.country_code.toLowerCase() === code
        ? { ...row, country_image_url: r.country_image_url || '', banner_color: r.banner_color || '#111111' }
        : row));
    }

    setSavingKey(null);
    setSavedKey(`retailer-${index}`);
    setTimeout(() => setSavedKey(null), 1500);
  }

  async function handleFileUpload(
    index: number,
    file: File,
    field: 'store_logo_url' | 'country_image_url',
  ) {
    const prefix = field === 'store_logo_url' ? 'vendor-logo' : 'country-image';
    setSavingKey(`upload-${index}-${field}`);
    try {
      const url = await uploadWorldwideAsset(file, prefix);
      updateRetailer(index, { [field]: url });
      // If this is a country image, mirror it into every row that shares the country_code
      if (field === 'country_image_url') {
        const code = retailers[index].country_code.toLowerCase().trim();
        if (code) {
          setRetailers(prev => prev.map(row => row.country_code.toLowerCase() === code
            ? { ...row, country_image_url: url }
            : row));
        }
      }
    } catch (err) {
      console.error(err);
      alert('이미지 업로드 실패. Supabase Storage 설정을 확인하세요.');
    } finally {
      setSavingKey(null);
    }
  }

  function addVendorForCountry(sourceIndex: number) {
    const src = retailers[sourceIndex];
    const nextSort = (src.sort_order || 0) + 1;
    const newRow: RetailerRow = {
      ...EMPTY_RETAILER,
      country_code: src.country_code,
      country_native: src.country_native,
      country_en: src.country_en,
      region: src.region,
      banner_color: src.banner_color,
      country_image_url: src.country_image_url,
      store_name: '',
      store_url: '#',
      store_logo_url: '',
      sort_order: nextSort,
    };
    setRetailers(prev => {
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, newRow);
      return next;
    });
  }

  async function deleteRetailer(index: number) {
    const r = retailers[index];
    if (!confirm(`${r.country_en} 을(를) 삭제하시겠습니까?`)) return;
    if (r.id && supabase) {
      const { error } = await supabase.from('worldwide_retailers').delete().eq('id', r.id);
      if (error) { alert(`삭제 실패: ${error.message}`); return; }
    }
    setRetailers(prev => prev.filter((_, i) => i !== index));
  }

  async function moveRetailer(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= retailers.length) return;
    const a = retailers[index];
    const b = retailers[j];
    setRetailers(prev => {
      const next = [...prev];
      next[index] = { ...a, sort_order: b.sort_order };
      next[j] = { ...b, sort_order: a.sort_order };
      return next;
    });
    if (supabase && a.id && b.id) {
      await Promise.all([
        supabase.from('worldwide_retailers').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('worldwide_retailers').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    }
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('labels')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            tab === 'labels' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          페이지 문구 (다국어)
        </button>
        <button
          onClick={() => setTab('retailers')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            tab === 'retailers' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List className="w-4 h-4" />
          판매처 ({retailers.length}개 벤더)
        </button>
      </div>

      {tab === 'labels' && (
        <div className="space-y-3">
          {/* Language picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">편집 언어</p>
            <div className="flex flex-wrap gap-1">
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l}
                  onClick={() => setEditLang(l)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                    editLang === l ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Label rows */}
          {labels.map(row => {
            const isOpen = openLabel === row.label_key;
            const title = LABEL_SECTION_TITLE[row.label_key] ?? row.label_key;
            return (
              <div key={row.label_key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenLabel(isOpen ? '' : row.label_key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-800">{title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xl">
                        {row[editLang] || <span className="italic">(비어 있음)</span>}
                      </p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 space-y-3">
                    {SUPPORTED_LANGS.map(l => (
                      <div key={l}>
                        <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-2">
                          {LANG_LABEL[l]}
                          {l === editLang && <span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded">현재</span>}
                        </label>
                        <input
                          type="text"
                          value={row[l] ?? ''}
                          onChange={e => updateLabel(row.label_key, l, e.target.value)}
                          className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => saveLabel(row)}
                      disabled={savingKey === row.label_key}
                      className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                        savedKey === row.label_key ? 'bg-green-500 text-white' : 'bg-[#111] text-white hover:bg-black'
                      } disabled:opacity-50`}
                    >
                      <Save className="w-4 h-4" />
                      {savingKey === row.label_key ? '저장 중...' : savedKey === row.label_key ? '✓ 저장 완료' : '저장'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'retailers' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1.5">
            <p className="font-semibold">💡 한 국가에 여러 벤더를 등록할 수 있습니다</p>
            <p>같은 <code className="bg-white px-1 rounded">국가 코드</code>를 가진 여러 행을 만들면 프론트에서 해당 국가 카드를 누를 때 벤더 목록이 함께 노출됩니다. (예: 중국 → Taobao, Shopee, Tmall)</p>
            <p><strong>국가 이미지</strong>는 같은 국가 코드의 모든 벤더 행에 자동 동기화됩니다. <strong>스토어 로고</strong>는 벤더별로 개별 설정됩니다.</p>
          </div>
          <button
            onClick={addRetailer}
            className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white rounded-lg text-sm font-semibold hover:bg-black transition"
          >
            <Plus className="w-4 h-4" /> 새 국가 추가
          </button>

          {retailers.map((r, index) => (
            <div key={r.id ?? `new-${index}`} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border border-gray-200"
                    style={{ backgroundColor: r.banner_color }}
                  />
                  <div>
                    <p className="text-sm font-bold">{r.country_en || '(새 국가)'}</p>
                    <p className="text-xs text-gray-500">{r.country_native}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveRetailer(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="위로"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveRetailer(index, 1)}
                    disabled={index === retailers.length - 1}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="아래로"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRetailer(index)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">국가 코드 (ISO)</label>
                  <input
                    type="text"
                    value={r.country_code}
                    onChange={e => updateRetailer(index, { country_code: e.target.value.toLowerCase() })}
                    placeholder="kr"
                    maxLength={2}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">원어명</label>
                  <input
                    type="text"
                    value={r.country_native}
                    onChange={e => updateRetailer(index, { country_native: e.target.value })}
                    placeholder="한국"
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">영문명</label>
                  <input
                    type="text"
                    value={r.country_en}
                    onChange={e => updateRetailer(index, { country_en: e.target.value })}
                    placeholder="South Korea"
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">지역</label>
                  <select
                    value={r.region}
                    onChange={e => updateRetailer(index, { region: e.target.value as Region })}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    {REGION_ORDER.map(reg => <option key={reg} value={reg}>{reg}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">스토어 이름</label>
                  <input
                    type="text"
                    value={r.store_name}
                    onChange={e => updateRetailer(index, { store_name: e.target.value })}
                    placeholder="Kokkok Garden Korea"
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">스토어 URL (# = 준비중)</label>
                  <input
                    type="text"
                    value={r.store_url}
                    onChange={e => updateRetailer(index, { store_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
                  />
                </div>

                {/* Vendor logo upload */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">스토어 로고 (벤더 로고)</label>
                  <div className="flex gap-2 mt-1 items-center">
                    {r.store_logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.store_logo_url} alt="" className="w-12 h-12 object-contain bg-white rounded border border-gray-200" />
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(index, f, 'store_logo_url'); }}
                      className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {r.store_logo_url && (
                      <button
                        type="button"
                        onClick={() => updateRetailer(index, { store_logo_url: '' })}
                        className="text-xs text-red-500 hover:underline px-2"
                      >
                        제거
                      </button>
                    )}
                  </div>
                  {savingKey === `upload-${index}-store_logo_url` && (
                    <p className="text-[10px] text-blue-500 mt-1">업로드 중...</p>
                  )}
                </div>

                {/* Country image upload — applies to all vendors sharing this country_code */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    국가 이미지 (같은 국가코드의 모든 벤더에 공통 적용)
                  </label>
                  <div className="flex gap-2 mt-1 items-center">
                    {r.country_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.country_image_url} alt="" className="w-20 h-12 object-cover rounded border border-gray-200" />
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(index, f, 'country_image_url'); }}
                      className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {r.country_image_url && (
                      <button
                        type="button"
                        onClick={() => updateRetailer(index, { country_image_url: '' })}
                        className="text-xs text-red-500 hover:underline px-2"
                      >
                        제거
                      </button>
                    )}
                  </div>
                  {savingKey === `upload-${index}-country_image_url` && (
                    <p className="text-[10px] text-blue-500 mt-1">업로드 중...</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">배너 색상</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={r.banner_color || '#111111'}
                      onChange={e => updateRetailer(index, { banner_color: e.target.value })}
                      className="w-10 h-10 border border-gray-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={r.banner_color}
                      onChange={e => updateRetailer(index, { banner_color: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">정렬 순서</label>
                  <input
                    type="number"
                    value={r.sort_order}
                    onChange={e => updateRetailer(index, { sort_order: Number(e.target.value) || 0 })}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={e => updateRetailer(index, { is_active: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    공개
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
                <button
                  onClick={() => saveRetailer(index)}
                  disabled={savingKey === `retailer-${index}`}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                    savedKey === `retailer-${index}` ? 'bg-green-500 text-white' : 'bg-[#111] text-white hover:bg-black'
                  } disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {savingKey === `retailer-${index}` ? '저장 중...'
                    : savedKey === `retailer-${index}` ? '✓ 저장 완료'
                    : (r.id ? '저장' : '추가')}
                </button>
                <button
                  type="button"
                  onClick={() => addVendorForCountry(index)}
                  disabled={!r.country_code}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
                  title="같은 국가에 다른 벤더 추가 (예: 중국 → Taobao, Shopee, Tmall)"
                >
                  <Plus className="w-4 h-4" /> 이 국가에 벤더 추가
                </button>
                <span className="text-xs text-gray-400">
                  {r.id ? `ID: ${r.id}` : '저장되지 않음'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
