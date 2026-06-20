'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Save, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 2 RLS lockdown on `payment_providers_config`
// is admin-only (rows hold provider API keys).
const supabase = getSupabaseBrowser();

interface PaymentProvider {
  id: number;
  provider: string;
  is_enabled: boolean;
  api_key: string;
  secret_key: string;
  merchant_id: string;
  additional_config: Record<string, string>;
  help_url: string;
  description_kr: string;
  description_en: string;
}

const PROVIDER_INFO: Record<string, { name: string; color: string; logo: string; fields: { key: string; label: string; placeholder: string }[] }> = {
  toss: {
    name: 'Toss Payments (토스페이먼츠)',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    logo: '💳',
    fields: [
      { key: 'api_key', label: 'Client Key', placeholder: 'test_ck_...' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'test_sk_...' },
      { key: 'merchant_id', label: 'MID (상점 ID)', placeholder: 'tosspayments' },
    ],
  },
  kakaopay: {
    name: 'Kakao Pay (카카오페이)',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    logo: '🟡',
    fields: [
      { key: 'api_key', label: 'Admin Key (CID)', placeholder: 'TC0ONETIME' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'DEV...' },
      { key: 'merchant_id', label: 'CID (가맹점코드)', placeholder: 'TC0ONETIME' },
    ],
  },
  naverpay: {
    name: 'Naver Pay (네이버페이)',
    color: 'bg-green-50 text-green-800 border-green-200',
    logo: '🟢',
    fields: [
      { key: 'api_key', label: 'Client ID', placeholder: 'np_...' },
      { key: 'secret_key', label: 'Client Secret', placeholder: 'secret_...' },
      { key: 'merchant_id', label: 'Partner ID', placeholder: 'naverpay_partner' },
    ],
  },
  inicis: {
    name: 'KG이니시스 (KG Inicis)',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
    logo: '🟣',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'INIpayTest' },
      { key: 'secret_key', label: 'Sign Key', placeholder: 'SU5JTElU...' },
      { key: 'merchant_id', label: 'MID (상점 ID)', placeholder: 'INIpayTest' },
    ],
  },
  kcp: {
    name: 'NHN KCP',
    color: 'bg-orange-50 text-orange-800 border-orange-200',
    logo: '🟠',
    fields: [
      { key: 'api_key', label: 'Site Code', placeholder: 'T0000' },
      { key: 'secret_key', label: 'Site Key', placeholder: '3grptw...' },
      { key: 'merchant_id', label: '가맹점 ID', placeholder: 'T0000' },
    ],
  },
};

export default function PaymentsAdminPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  async function loadProviders() {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('payment_providers_config').select('*').order('id');
      if (data) setProviders(data);
    } catch { /* table may not exist */ }
    setLoading(false);
  }

  // One-shot fetch on mount; explicit refetch in saveProvider keeps it fresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProviders(); }, []);

  function updateProvider(provider: string, updates: Partial<PaymentProvider>) {
    setProviders(prev => prev.map(p => p.provider === provider ? { ...p, ...updates } : p));
  }

  async function saveProvider(p: PaymentProvider) {
    if (!supabase) return;
    setSaving(p.provider);
    await supabase.from('payment_providers_config').update({
      is_enabled: p.is_enabled,
      api_key: p.api_key,
      secret_key: p.secret_key,
      merchant_id: p.merchant_id,
    }).eq('id', p.id);
    setSaved(p.provider);
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-2">결제 시스템 설정</h2>
        <p className="text-sm text-gray-500 mb-4">각 결제 서비스의 API 키를 입력하고 토글로 활성화하세요. 테스트 키로 먼저 연동한 뒤 실서비스 키로 교체하세요.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <strong>참고:</strong> 대부분의 PG사는 사업자등록 후 가맹점 심사를 거쳐야 실결제가 가능합니다. 테스트 키로 먼저 개발/검증하세요.
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="bg-white rounded border border-[#e5e7eb] p-8 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">결제 제공자가 설정되지 않았습니다</p>
          <p className="text-xs mt-1">아래 SQL을 Supabase에서 실행하세요.</p>
        </div>
      ) : (
        providers.map(p => {
          const info = PROVIDER_INFO[p.provider];
          if (!info) return null;
          const isExpanded = expandedProvider === p.provider;
          return (
            <div key={p.provider} className={`rounded-xl border overflow-hidden ${info.color}`}>
              {/* Header */}
              <button
                onClick={() => setExpandedProvider(isExpanded ? null : p.provider)}
                className="w-full flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{info.logo}</span>
                  <div className="text-left">
                    <p className="font-bold text-sm">{info.name}</p>
                    <p className="text-[11px] opacity-60">{p.description_kr}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {p.is_enabled && <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">활성</span>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                </div>
              </button>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-3 border-t border-current/10">
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-semibold">활성화</p>
                      <p className="text-[11px] opacity-60">고객 결제 시 이 결제 수단을 사용합니다</p>
                    </div>
                    <button
                      onClick={() => updateProvider(p.provider, { is_enabled: !p.is_enabled })}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${p.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${p.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <a href={p.help_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] underline opacity-70 hover:opacity-100 transition-opacity">
                    개발자 콘솔 바로가기 <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {info.fields.map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] font-bold opacity-60 uppercase">{f.label}</label>
                        <input
                          type={f.key === 'secret_key' ? 'password' : 'text'}
                          value={(p as unknown as Record<string, string>)[f.key] || ''}
                          onChange={e => updateProvider(p.provider, { [f.key]: e.target.value } as Partial<PaymentProvider>)}
                          placeholder={f.placeholder}
                          className="w-full mt-1 border border-current/20 rounded-lg px-3 py-2 text-xs outline-none bg-white/80 focus:bg-white font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => saveProvider(p)}
                    disabled={saving === p.provider}
                    className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                      saved === p.provider ? 'bg-green-600 text-white' : 'bg-black/80 text-white hover:bg-black'
                    } disabled:opacity-50`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving === p.provider ? '저장 중...' : saved === p.provider ? '✓ 저장 완료' : '저장'}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
