'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, ExternalLink, Key, Shield, UserPlus, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client (was the bare anon client). The Phase 1 RLS
// lockdown requires the admin's JWT to ride along on every write so
// is_admin() can pass — see migration 00000000000017.
const supabase = getSupabaseBrowser();

function SectionHeader({
  id,
  title,
  icon: Icon,
  openSection,
  setOpenSection,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  openSection: string;
  setOpenSection: (v: string) => void;
}) {
  return (
    <button
      onClick={() => setOpenSection(openSection === id ? '' : id)}
      className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-500" />
        <h2 className="text-[14px] font-bold text-[#1f2937]">{title}</h2>
      </div>
      {openSection === id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
  );
}

interface RegField {
  key: string;
  label_kr: string;
  label_en: string;
  type: string;
  required: boolean;
  enabled: boolean;
  removable: boolean;
  options_kr?: string[];
  options_en?: string[];
}

interface AuthProvider {
  id: number;
  provider: string;
  is_enabled: boolean;
  client_id: string;
  client_secret: string;
  help_url: string;
  description_kr: string;
}

interface VerificationConfig {
  is_enabled: boolean;
  provider: string;
  api_key: string;
  secret_key: string;
  merchant_id: string;
  help_url: string;
  description_kr: string;
}

interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  gender: string;
  country: string;
  skin_type: string;
  marketing_consent: boolean;
  auth_provider: string;
  created_at: string;
}

const PROVIDER_LOGOS: Record<string, { name: string; color: string; fields: string[] }> = {
  google: { name: 'Google', color: 'bg-red-50 text-red-700 border-red-200', fields: ['Client ID', 'Client Secret'] },
  kakao: { name: 'Kakao', color: 'bg-yellow-50 text-yellow-800 border-yellow-200', fields: ['REST API Key', 'Client Secret'] },
  naver: { name: 'Naver', color: 'bg-green-50 text-green-700 border-green-200', fields: ['Client ID', 'Client Secret'] },
  apple: { name: 'Apple', color: 'bg-gray-50 text-gray-700 border-gray-200', fields: ['Service ID', 'Key ID / Secret'] },
};

const VERIFICATION_PROVIDERS = [
  { value: 'nice', label: 'NICE 본인인증', url: 'https://www.niceapi.co.kr/' },
  { value: 'kcp', label: 'NHN KCP', url: 'https://admin8.kcp.co.kr/' },
  { value: 'pass', label: 'PASS 인증', url: 'https://www.passauth.co.kr/' },
];

export default function RegistrationAdminPage() {
  const [fields, setFields] = useState<RegField[]>([]);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [verification, setVerification] = useState<VerificationConfig>({
    is_enabled: false, provider: 'nice', api_key: '', secret_key: '', merchant_id: '',
    help_url: 'https://www.niceapi.co.kr/', description_kr: '',
  });
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('fields');

  // New field form
  const [newField, setNewField] = useState({ key: '', label_kr: '', label_en: '', type: 'text' });

  async function loadAll() {
    if (!supabase) { setLoading(false); return; }
    try {
      const [regRes, authRes, verRes, custRes] = await Promise.all([
        supabase.from('registration_config').select('*').single(),
        supabase.from('auth_providers_config').select('*').order('id'),
        supabase.from('identity_verification_config').select('*').single(),
        supabase.from('customer_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (regRes.data) {
        setFields(regRes.data.fields || []);
        setMarketingConsent(regRes.data.require_marketing_consent ?? true);
        setPrivacyConsent(regRes.data.require_privacy_consent ?? true);
      }
      if (authRes.data) setAuthProviders(authRes.data);
      if (verRes.data) setVerification({
        is_enabled: verRes.data.is_enabled ?? false,
        provider: verRes.data.provider ?? 'nice',
        api_key: verRes.data.api_key ?? '',
        secret_key: verRes.data.secret_key ?? '',
        merchant_id: verRes.data.merchant_id ?? '',
        help_url: verRes.data.help_url ?? '',
        description_kr: verRes.data.description_kr ?? '',
      });
      if (custRes.data) setCustomers(custRes.data);
    } catch { /* tables may not exist */ }
    setLoading(false);
  }

  // One-shot fetch on mount; explicit refetch in save handlers keeps it fresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, []);

  async function saveFields() {
    if (!supabase) return;
    setSaving('fields');
    await supabase.from('registration_config').upsert({
      id: 1, fields, require_marketing_consent: marketingConsent, require_privacy_consent: privacyConsent,
    });
    setSaved('fields');
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  async function saveProvider(p: AuthProvider) {
    if (!supabase) return;
    setSaving(`provider-${p.provider}`);
    await supabase.from('auth_providers_config').update({
      is_enabled: p.is_enabled,
      client_id: p.client_id,
      client_secret: p.client_secret,
    }).eq('id', p.id);
    setSaved(`provider-${p.provider}`);
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  async function saveVerification() {
    if (!supabase) return;
    setSaving('verification');
    await supabase.from('identity_verification_config').upsert({
      id: 1, ...verification,
    });
    setSaved('verification');
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  function toggleField(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }
  function toggleRequired(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f));
  }
  function removeField(key: string) {
    setFields(prev => prev.filter(f => f.key !== key));
  }
  function addField() {
    if (!newField.key || !newField.label_kr) return;
    setFields(prev => [...prev, {
      ...newField, required: false, enabled: true, removable: true,
    }]);
    setNewField({ key: '', label_kr: '', label_en: '', type: 'text' });
  }
  function moveField(index: number, dir: -1 | 1) {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  function updateProvider(provider: string, updates: Partial<AuthProvider>) {
    setAuthProviders(prev => prev.map(p => p.provider === provider ? { ...p, ...updates } : p));
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">

      {/* ═══ Section 1: Registration Fields ═══ */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <SectionHeader id="fields" title="회원가입 항목 관리" icon={UserPlus} openSection={openSection} setOpenSection={setOpenSection} />
        {openSection === 'fields' && (
          <div className="p-5 pt-0 space-y-4">
            <p className="text-sm text-gray-500">고객 회원가입 시 수집할 항목을 관리합니다. 드래그하여 순서를 변경하거나, 토글로 활성/비활성 할 수 있습니다.</p>

            {/* Field list */}
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.key} className={`flex items-center gap-3 p-3 rounded-lg border ${f.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{f.label_kr}</span>
                      <span className="text-[10px] text-gray-400">{f.label_en}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{f.type}</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={f.required} onChange={() => toggleRequired(f.key)} className="w-3.5 h-3.5 rounded" />
                    필수
                  </label>
                  <button
                    onClick={() => toggleField(f.key)}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${f.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  {f.removable && (
                    <button onClick={() => removeField(f.key)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add custom field */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-semibold mb-3">+ 커스텀 항목 추가</p>
              <div className="grid grid-cols-4 gap-2">
                <input type="text" placeholder="key (영문)" value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value.replace(/\s/g, '_').toLowerCase() }))} className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
                <input type="text" placeholder="라벨 (한국어)" value={newField.label_kr} onChange={e => setNewField(p => ({ ...p, label_kr: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
                <input type="text" placeholder="Label (English)" value={newField.label_en} onChange={e => setNewField(p => ({ ...p, label_en: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
                <div className="flex gap-2">
                  <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none">
                    <option value="text">텍스트</option>
                    <option value="email">이메일</option>
                    <option value="tel">전화번호</option>
                    <option value="date">날짜</option>
                    <option value="select">선택</option>
                    <option value="textarea">장문</option>
                  </select>
                  <button onClick={addField} disabled={!newField.key || !newField.label_kr} className="bg-[#3b82f6] text-white px-3 rounded-lg text-xs font-semibold disabled:opacity-30 hover:bg-[#2563eb] transition">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Legal consent toggles */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">법적 동의 항목</p>
              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-800">개인정보 처리 동의</p>
                  <p className="text-[11px] text-gray-400">개인정보보호법 제15조에 따른 필수 동의</p>
                </div>
                <input type="checkbox" checked={privacyConsent} onChange={() => setPrivacyConsent(!privacyConsent)} className="w-4 h-4 rounded" />
              </label>
              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-800">마케팅 수신 동의</p>
                  <p className="text-[11px] text-gray-400">이메일, SMS 등 마케팅 정보 수신 (선택)</p>
                </div>
                <input type="checkbox" checked={marketingConsent} onChange={() => setMarketingConsent(!marketingConsent)} className="w-4 h-4 rounded" />
              </label>
            </div>

            <button onClick={saveFields} disabled={saving === 'fields'} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${saved === 'fields' ? 'bg-green-500 text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
              <Save className="w-4 h-4" />
              {saving === 'fields' ? '저장 중...' : saved === 'fields' ? '✓ 저장 완료' : '항목 설정 저장'}
            </button>
          </div>
        )}
      </div>

      {/* ═══ Section 2: Social Login Providers ═══ */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <SectionHeader id="social" title="소셜 로그인 설정" icon={Key} openSection={openSection} setOpenSection={setOpenSection} />
        {openSection === 'social' && (
          <div className="p-5 pt-0 space-y-4">
            <p className="text-sm text-gray-500">각 소셜 로그인 제공자의 API 키를 입력하고 활성화하세요. 키를 발급받으려면 각 링크를 클릭하세요.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              <strong>Supabase Redirect URI</strong> (각 제공자에 등록 필요):<br />
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">{process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback</code>
            </div>

            {authProviders.map(p => {
              const info = PROVIDER_LOGOS[p.provider];
              if (!info) return null;
              return (
                <div key={p.provider} className={`border rounded-xl p-4 space-y-3 ${info.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{info.name}</span>
                      <a href={p.help_url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity underline">
                        API 키 발급 <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button
                      onClick={() => updateProvider(p.provider, { is_enabled: !p.is_enabled })}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${p.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${p.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-[11px] opacity-70">{p.description_kr}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold opacity-60 uppercase">{info.fields[0]}</label>
                      <input type="text" value={p.client_id} onChange={e => updateProvider(p.provider, { client_id: e.target.value })} placeholder={`${info.name} ${info.fields[0]}`} className="w-full mt-1 border border-current/20 rounded-lg px-3 py-2 text-xs outline-none bg-white/80 focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold opacity-60 uppercase">{info.fields[1]}</label>
                      <input type="password" value={p.client_secret} onChange={e => updateProvider(p.provider, { client_secret: e.target.value })} placeholder={`${info.name} ${info.fields[1]}`} className="w-full mt-1 border border-current/20 rounded-lg px-3 py-2 text-xs outline-none bg-white/80 focus:bg-white" />
                    </div>
                  </div>
                  <button onClick={() => saveProvider(p)} disabled={saving === `provider-${p.provider}`} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${saved === `provider-${p.provider}` ? 'bg-green-600 text-white' : 'bg-black/80 text-white hover:bg-black'} disabled:opacity-50`}>
                    {saving === `provider-${p.provider}` ? '저장 중...' : saved === `provider-${p.provider}` ? '✓ 저장됨' : '저장'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Section 3: Identity Verification ═══ */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <SectionHeader id="verification" title="본인인증 (Identity Verification)" icon={Shield} openSection={openSection} setOpenSection={setOpenSection} />
        {openSection === 'verification' && (
          <div className="p-5 pt-0 space-y-4">
            <p className="text-sm text-gray-500">한국 내 구매를 위한 본인인증 서비스를 설정합니다. 본인인증 제공자의 API 키를 입력하세요.</p>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
              <div>
                <p className="font-semibold text-gray-800 text-sm">본인인증 활성화</p>
                <p className="text-[11px] text-gray-400">구매 시 본인인증을 요구합니다</p>
              </div>
              <button
                onClick={() => setVerification(v => ({ ...v, is_enabled: !v.is_enabled }))}
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${verification.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${verification.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">인증 제공자</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {VERIFICATION_PROVIDERS.map(vp => (
                  <button
                    key={vp.value}
                    onClick={() => setVerification(v => ({ ...v, provider: vp.value, help_url: vp.url }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${verification.provider === vp.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="text-sm font-semibold">{vp.label}</p>
                    <a href={vp.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 flex items-center gap-1 mt-1">
                      콘솔 바로가기 <ExternalLink className="w-3 h-3" />
                    </a>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">API Key</label>
                <input type="text" value={verification.api_key} onChange={e => setVerification(v => ({ ...v, api_key: e.target.value }))} placeholder="API Key" className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">Secret Key</label>
                <input type="password" value={verification.secret_key} onChange={e => setVerification(v => ({ ...v, secret_key: e.target.value }))} placeholder="Secret Key" className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">Merchant ID</label>
                <input type="text" value={verification.merchant_id} onChange={e => setVerification(v => ({ ...v, merchant_id: e.target.value }))} placeholder="Merchant ID" className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
              </div>
            </div>

            <button onClick={saveVerification} disabled={saving === 'verification'} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${saved === 'verification' ? 'bg-green-500 text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
              <Save className="w-4 h-4" />
              {saving === 'verification' ? '저장 중...' : saved === 'verification' ? '✓ 저장 완료' : '본인인증 설정 저장'}
            </button>
          </div>
        )}
      </div>

      {/* ═══ Section 4: Customer Data ═══ */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <SectionHeader id="customers" title="수집된 고객 데이터" icon={UserPlus} openSection={openSection} setOpenSection={setOpenSection} />
        {openSection === 'customers' && (
          <div className="p-5 pt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">가입된 고객 정보</p>
              <span className="text-xs text-gray-400">{customers.length}명</span>
            </div>
            {customers.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">아직 가입된 고객이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">이름</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">이메일</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">전화번호</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">국가</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">피부</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">마케팅</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(c => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-800">{c.name || '—'}</td>
                        <td className="py-2 px-2 text-blue-600 text-xs">{c.email || '—'}</td>
                        <td className="py-2 px-2 text-gray-600 text-xs">{c.phone || '—'}</td>
                        <td className="py-2 px-2 text-gray-600 text-xs">{c.country || '—'}</td>
                        <td className="py-2 px-2 text-gray-600 text-xs">{c.skin_type || '—'}</td>
                        <td className="py-2 px-2">{c.marketing_consent ? <span className="text-green-600 text-xs">✓</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
